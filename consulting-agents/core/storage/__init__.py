"""
Multi-Agent Collaboration Platform - Storage Layer

This module provides dual storage capabilities:
- Local file storage (JSON/YAML) for agent definitions and cache
- PostgreSQL for session history, memory, and audit logs
- Bidirectional sync between local and database storage
"""

from abc import ABC, abstractmethod
from typing import Any, Optional, List, Dict
from datetime import datetime
from pathlib import Path
from enum import Enum
import json
import yaml
import os


class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles datetime and other special types."""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        return super().default(obj)


def json_dumps(data: Any) -> str:
    """Serialize data to JSON string with custom encoder."""
    return json.dumps(data, indent=2, ensure_ascii=False, cls=JSONEncoder)


class StorageError(Exception):
    """Base exception for storage operations"""
    pass


class RecordNotFoundError(StorageError):
    """Raised when a requested record is not found"""
    pass


class ConflictError(StorageError):
    """Raised when there's a sync conflict"""
    pass


class StorageInterface(ABC):
    """Abstract base class for storage implementations"""

    @abstractmethod
    def save(self, collection: str, key: str, data: Dict[str, Any]) -> None:
        """Save data to storage"""
        pass

    @abstractmethod
    def load(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        """Load data from storage"""
        pass

    @abstractmethod
    def delete(self, collection: str, key: str) -> bool:
        """Delete data from storage"""
        pass

    @abstractmethod
    def list_keys(self, collection: str) -> List[str]:
        """List all keys in a collection"""
        pass

    @abstractmethod
    def query(self, collection: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Query data with filters"""
        pass


class LocalStorage(StorageInterface):
    """
    Local file-based storage for JSON/YAML files.
    Used for agent definitions, local cache, and offline mode.
    """

    def __init__(self, base_path: str = ".data"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_collection_path(self, collection: str) -> Path:
        """Get the path for a collection"""
        path = self.base_path / collection
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _get_file_path(self, collection: str, key: str) -> Path:
        """Get the file path for a record"""
        # Support both .json and .yaml extensions
        collection_path = self._get_collection_path(collection)

        # Try different extensions
        for ext in ['.yaml', '.yml', '.json']:
            file_path = collection_path / f"{key}{ext}"
            if file_path.exists():
                return file_path

        # Default to .json for new files
        return collection_path / f"{key}.json"

    def save(self, collection: str, key: str, data: Dict[str, Any]) -> None:
        """Save data to local storage"""
        file_path = self._get_file_path(collection, key)

        # Add metadata
        data['_metadata'] = {
            'saved_at': datetime.utcnow().isoformat(),
            'storage_type': 'local'
        }

        # Determine format based on existing file or content
        if file_path.suffix in ['.yaml', '.yml'] or collection == 'agents':
            # Use YAML for agent definitions and existing YAML files
            file_path = file_path.with_suffix('.yaml')
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
        else:
            # Use JSON for other data
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False, cls=JSONEncoder)

    def load(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        """Load data from local storage"""
        file_path = self._get_file_path(collection, key)

        if not file_path.exists():
            return None

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                if file_path.suffix in ['.yaml', '.yml']:
                    return yaml.safe_load(f)
                else:
                    return json.load(f)
        except Exception as e:
            raise StorageError(f"Failed to load {collection}/{key}: {e}")

    def delete(self, collection: str, key: str) -> bool:
        """Delete data from local storage"""
        file_path = self._get_file_path(collection, key)

        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def list_keys(self, collection: str) -> List[str]:
        """List all keys in a collection"""
        collection_path = self._get_collection_path(collection)

        if not collection_path.exists():
            return []

        keys = []
        for file_path in collection_path.iterdir():
            if file_path.is_file() and file_path.suffix in ['.json', '.yaml', '.yml']:
                keys.append(file_path.stem)

        return keys

    def query(self, collection: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Query data with simple filters (loads all and filters in memory)"""
        results = []

        for key in self.list_keys(collection):
            data = self.load(collection, key)
            if data is None:
                continue

            # Check if all filters match
            match = True
            for field, value in filters.items():
                if field not in data or data[field] != value:
                    match = False
                    break

            if match:
                results.append(data)

        return results

    def load_raw_file(self, file_path: str) -> str:
        """Load raw file content (for agent markdown files)"""
        full_path = self.base_path / file_path

        if not full_path.exists():
            raise RecordNotFoundError(f"File not found: {file_path}")

        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()

    def save_raw_file(self, file_path: str, content: str) -> None:
        """Save raw file content"""
        full_path = self.base_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def list_files(self, pattern: str) -> List[str]:
        """List files matching a glob pattern"""
        return [str(p.relative_to(self.base_path))
                for p in self.base_path.glob(pattern)]


class PostgresStorage(StorageInterface):
    """
    PostgreSQL storage for production data.
    Used for session history, audit logs, and as primary storage.
    """

    def __init__(self, connection_string: Optional[str] = None):
        self.connection_string = connection_string or os.getenv(
            'DATABASE_URL',
            'postgresql://localhost:5432/consulting_agents'
        )
        self._engine = None
        self._Session = None

    def _get_engine(self):
        """Lazy initialization of SQLAlchemy engine"""
        if self._engine is None:
            try:
                from sqlalchemy import create_engine
                self._engine = create_engine(self.connection_string)
            except ImportError:
                raise StorageError(
                    "SQLAlchemy is required for PostgreSQL storage. "
                    "Install with: pip install sqlalchemy psycopg2-binary"
                )
        return self._engine

    def _get_session(self):
        """Get a database session"""
        if self._Session is None:
            from sqlalchemy.orm import sessionmaker
            self._Session = sessionmaker(bind=self._get_engine())
        return self._Session()

    def _ensure_table(self, collection: str):
        """Ensure a collection table exists"""
        from sqlalchemy import Table, Column, String, JSON, DateTime, MetaData, text

        metadata = MetaData()

        # Create table if not exists
        table = Table(
            collection,
            metadata,
            Column('key', String, primary_key=True),
            Column('data', JSON),
            Column('created_at', DateTime, default=datetime.utcnow),
            Column('updated_at', DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
            extend_existing=True
        )

        # Use CREATE TABLE IF NOT EXISTS
        with self._get_engine().connect() as conn:
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {collection} (
                    key VARCHAR PRIMARY KEY,
                    data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()

        return table

    def save(self, collection: str, key: str, data: Dict[str, Any]) -> None:
        """Save data to PostgreSQL"""
        from sqlalchemy import text

        self._ensure_table(collection)

        # Add metadata
        data['_metadata'] = {
            'saved_at': datetime.utcnow().isoformat(),
            'storage_type': 'postgres'
        }

        with self._get_engine().connect() as conn:
            conn.execute(
                text(f"""
                    INSERT INTO {collection} (key, data, updated_at)
                    VALUES (:key, :data, CURRENT_TIMESTAMP)
                    ON CONFLICT (key) DO UPDATE
                    SET data = :data, updated_at = CURRENT_TIMESTAMP
                """),
                {'key': key, 'data': json.dumps(data)}
            )
            conn.commit()

    def load(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        """Load data from PostgreSQL"""
        from sqlalchemy import text

        self._ensure_table(collection)

        with self._get_engine().connect() as conn:
            result = conn.execute(
                text(f"SELECT data FROM {collection} WHERE key = :key"),
                {'key': key}
            ).fetchone()

            if result is None:
                return None

            return json.loads(result[0])

    def delete(self, collection: str, key: str) -> bool:
        """Delete data from PostgreSQL"""
        from sqlalchemy import text

        self._ensure_table(collection)

        with self._get_engine().connect() as conn:
            result = conn.execute(
                text(f"DELETE FROM {collection} WHERE key = :key"),
                {'key': key}
            )
            conn.commit()
            return result.rowcount > 0

    def list_keys(self, collection: str) -> List[str]:
        """List all keys in a collection"""
        from sqlalchemy import text

        self._ensure_table(collection)

        with self._get_engine().connect() as conn:
            result = conn.execute(text(f"SELECT key FROM {collection}"))
            return [row[0] for row in result]

    def query(self, collection: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Query data with JSONB filters"""
        from sqlalchemy import text

        self._ensure_table(collection)

        # Build JSONB filter conditions
        conditions = []
        params = {}

        for i, (field, value) in enumerate(filters.items()):
            param_name = f"param_{i}"
            conditions.append(f"data->>:field_{i} = :{param_name}")
            params[f"field_{i}"] = field
            params[param_name] = json.dumps(value) if isinstance(value, (dict, list)) else str(value)

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        with self._get_engine().connect() as conn:
            result = conn.execute(
                text(f"SELECT data FROM {collection} WHERE {where_clause}"),
                params
            )
            return [json.loads(row[0]) for row in result]

    def execute_sql(self, sql: str, params: Optional[Dict] = None) -> List[Dict]:
        """Execute raw SQL query (for complex queries)"""
        from sqlalchemy import text

        with self._get_engine().connect() as conn:
            result = conn.execute(text(sql), params or {})
            columns = result.keys()
            return [dict(zip(columns, row)) for row in result]


class SyncManager:
    """
    Manages bidirectional synchronization between local and PostgreSQL storage.
    """

    def __init__(
        self,
        local: LocalStorage,
        postgres: Optional[PostgresStorage] = None,
        sync_config: Optional[Dict] = None
    ):
        self.local = local
        self.postgres = postgres
        self.sync_config = sync_config or {}
        self._sync_log_collection = '_sync_log'

    def sync_to_postgres(self, collection: str, key: str) -> bool:
        """Sync a record from local to PostgreSQL"""
        if self.postgres is None:
            return False

        data = self.local.load(collection, key)
        if data is None:
            return False

        # Check for conflicts
        existing = self.postgres.load(collection, key)
        if existing and self._has_conflict(data, existing):
            resolution = self._resolve_conflict(data, existing, collection, key)
            if resolution == 'local':
                data = data
            else:
                return False  # Keep postgres version

        self.postgres.save(collection, key, data)
        self._log_sync('local_to_postgres', collection, key)
        return True

    def sync_from_postgres(self, collection: str, key: str) -> bool:
        """Sync a record from PostgreSQL to local"""
        if self.postgres is None:
            return False

        data = self.postgres.load(collection, key)
        if data is None:
            return False

        # Check for conflicts
        existing = self.local.load(collection, key)
        if existing and self._has_conflict(data, existing):
            resolution = self._resolve_conflict(existing, data, collection, key)
            if resolution == 'postgres':
                data = data
            else:
                return False  # Keep local version

        self.local.save(collection, key, data)
        self._log_sync('postgres_to_local', collection, key)
        return True

    def bidirectional_sync(self, collection: str) -> Dict[str, List[str]]:
        """
        Perform bidirectional sync for a collection.
        Returns sync results with lists of synced keys.
        """
        if self.postgres is None:
            return {'to_postgres': [], 'to_local': [], 'conflicts': []}

        results = {
            'to_postgres': [],
            'to_local': [],
            'conflicts': []
        }

        # Get all keys from both storages
        local_keys = set(self.local.list_keys(collection))
        postgres_keys = set(self.postgres.list_keys(collection))

        # Sync local-only records to postgres
        for key in local_keys - postgres_keys:
            if self.sync_to_postgres(collection, key):
                results['to_postgres'].append(key)

        # Sync postgres-only records to local
        for key in postgres_keys - local_keys:
            if self.sync_from_postgres(collection, key):
                results['to_local'].append(key)

        # Handle records in both (potential conflicts)
        for key in local_keys & postgres_keys:
            local_data = self.local.load(collection, key)
            postgres_data = self.postgres.load(collection, key)

            if self._has_conflict(local_data, postgres_data):
                resolution = self._resolve_conflict(
                    local_data, postgres_data, collection, key
                )
                if resolution == 'local':
                    self.postgres.save(collection, key, local_data)
                    results['to_postgres'].append(key)
                elif resolution == 'postgres':
                    self.local.save(collection, key, postgres_data)
                    results['to_local'].append(key)
                else:
                    results['conflicts'].append(key)

        return results

    def _has_conflict(self, local_data: Dict, postgres_data: Dict) -> bool:
        """Check if there's a conflict between local and postgres versions"""
        # Get timestamps
        local_ts = local_data.get('_metadata', {}).get('saved_at', '')
        postgres_ts = postgres_data.get('_metadata', {}).get('saved_at', '')

        # If timestamps differ significantly, there's a potential conflict
        if local_ts and postgres_ts and local_ts != postgres_ts:
            return True

        # Compare data (excluding metadata)
        local_copy = {k: v for k, v in local_data.items() if k != '_metadata'}
        postgres_copy = {k: v for k, v in postgres_data.items() if k != '_metadata'}

        return local_copy != postgres_copy

    def _resolve_conflict(
        self,
        local_data: Dict,
        postgres_data: Dict,
        collection: str,
        key: str
    ) -> str:
        """
        Resolve sync conflicts using configured strategy.
        Returns: 'local', 'postgres', or 'manual'
        """
        strategy = self.sync_config.get('conflict_resolution', 'timestamp')

        if strategy == 'local_wins':
            return 'local'
        elif strategy == 'postgres_wins':
            return 'postgres'
        elif strategy == 'timestamp':
            # Compare timestamps
            local_ts = local_data.get('_metadata', {}).get('saved_at', '')
            postgres_ts = postgres_data.get('_metadata', {}).get('saved_at', '')

            if local_ts > postgres_ts:
                return 'local'
            else:
                return 'postgres'
        else:
            # Manual resolution required
            return 'manual'

    def _log_sync(self, direction: str, collection: str, key: str) -> None:
        """Log a sync operation"""
        log_entry = {
            'direction': direction,
            'collection': collection,
            'key': key,
            'timestamp': datetime.utcnow().isoformat()
        }

        # Save to local sync log
        log_key = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{collection}_{key}"
        self.local.save(self._sync_log_collection, log_key, log_entry)


class HybridStorage(StorageInterface):
    """
    Hybrid storage that combines local and PostgreSQL storage.
    Provides a unified interface with configurable storage preferences.
    """

    def __init__(
        self,
        local_base_path: str = ".data",
        postgres_connection: Optional[str] = None,
        storage_preferences: Optional[Dict[str, str]] = None
    ):
        self.local = LocalStorage(local_base_path)
        self.postgres = PostgresStorage(postgres_connection) if postgres_connection else None
        self.sync_manager = SyncManager(self.local, self.postgres)

        # Define which storage is primary for each collection
        self.preferences = storage_preferences or {
            'agents': 'local',           # Agent definitions in Markdown/YAML
            'sessions': 'postgres',      # Session history in database
            'messages': 'postgres',      # Messages in database
            'memories': 'postgres',      # Agent memories in database
            'audit_logs': 'postgres',    # Audit logs only in database
            'evolution': 'both',         # Evolution records in both
            'cache': 'local',            # Cache locally
        }

    def _get_primary_storage(self, collection: str) -> StorageInterface:
        """Get the primary storage for a collection"""
        preference = self.preferences.get(collection, 'local')

        if preference == 'postgres' and self.postgres:
            return self.postgres
        elif preference == 'both':
            # Default to postgres for 'both', with local backup
            return self.postgres if self.postgres else self.local
        else:
            return self.local

    def save(self, collection: str, key: str, data: Dict[str, Any]) -> None:
        """Save data to appropriate storage(s)"""
        preference = self.preferences.get(collection, 'local')

        if preference == 'local':
            self.local.save(collection, key, data)
        elif preference == 'postgres':
            if self.postgres:
                self.postgres.save(collection, key, data)
            else:
                self.local.save(collection, key, data)
        elif preference == 'both':
            # Save to both storages
            self.local.save(collection, key, data)
            if self.postgres:
                self.postgres.save(collection, key, data)

    def load(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        """Load data from appropriate storage"""
        primary = self._get_primary_storage(collection)
        return primary.load(collection, key)

    def delete(self, collection: str, key: str) -> bool:
        """Delete data from all storages"""
        preference = self.preferences.get(collection, 'local')

        results = []
        if preference in ['local', 'both']:
            results.append(self.local.delete(collection, key))
        if preference in ['postgres', 'both'] and self.postgres:
            results.append(self.postgres.delete(collection, key))

        return any(results)

    def list_keys(self, collection: str) -> List[str]:
        """List keys from primary storage"""
        primary = self._get_primary_storage(collection)
        return primary.list_keys(collection)

    def query(self, collection: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Query data from primary storage"""
        primary = self._get_primary_storage(collection)
        return primary.query(collection, filters)

    def sync_collection(self, collection: str) -> Dict[str, List[str]]:
        """Sync an entire collection between storages"""
        return self.sync_manager.bidirectional_sync(collection)

    def get_agent_markdown(self, agent_name: str) -> str:
        """Load raw agent markdown file"""
        # Look for agent files in the agents directory
        file_path = f"agents/{agent_name}.md"
        try:
            return self.local.load_raw_file(file_path)
        except RecordNotFoundError:
            # Try without subdirectory
            return self.local.load_raw_file(f"{agent_name}.md")

    def save_agent_markdown(self, agent_name: str, content: str) -> None:
        """Save raw agent markdown file"""
        file_path = f"agents/{agent_name}.md"
        self.local.save_raw_file(file_path, content)

    def list_agents(self) -> List[str]:
        """List all agent definitions"""
        try:
            files = self.local.list_files("agents/*.md")
            return [Path(f).stem for f in files]
        except:
            return []
