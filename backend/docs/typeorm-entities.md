# TypeORM 实体设计规范文档

## 概述

本文档提供基于 `schema.sql` 的 TypeORM 实体设计规范，包含完整的实体定义、关系映射、索引配置和生命周期钩子。

---

## 1. 基础配置

### 1.1 数据库连接配置

```typescript
// backend/src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'research_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'research_tool',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // 生产环境必须关闭
  logging: process.env.NODE_ENV === 'development',
  // 连接池配置
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};
```

### 1.2 抽象基类

```typescript
// backend/src/entities/base.entity.ts
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}
```

---

## 2. 用户与租户实体

### 2.1 TenantEntity (租户)

```typescript
// backend/src/entities/tenant.entity.ts
import {
  Entity,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { InterviewSessionEntity } from './interview-session.entity';
import { CaseEntity } from './case.entity';
import { ClientProfileEntity } from './client-profile.entity';

@Entity('tenants')
@Index(['slug'], { unique: true })
export class TenantEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({
    type: 'jsonb',
    default: {
      provider: 'moonshot',
      model: 'kimi-k2.5',
      temperature: 0.7,
    },
  })
  aiConfig: {
    provider: string;
    model: string;
    temperature: number;
    topP?: number;
    maxTokens?: number;
  };

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  // 关系
  @OneToMany(() => UserEntity, (user) => user.defaultTenant)
  users: UserEntity[];

  @OneToMany(() => InterviewSessionEntity, (session) => session.tenant)
  interviewSessions: InterviewSessionEntity[];

  @OneToMany(() => CaseEntity, (caseItem) => caseItem.tenant)
  cases: CaseEntity[];

  @OneToMany(() => ClientProfileEntity, (client) => client.tenant)
  clients: ClientProfileEntity[];
}
```

### 2.2 TenantMemberEntity (租户成员关系)

```typescript
// backend/src/entities/tenant-member.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Entity('tenant_members')
@Index(['tenantId', 'userId'], { unique: true })
export class TenantMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: MemberRole,
    default: MemberRole.MEMBER,
  })
  role: MemberRole;

  @CreateDateColumn({ type: 'timestamptz', name: 'joined_at' })
  joinedAt: Date;

  // 关系
  @ManyToOne(() => TenantEntity, (tenant) => tenant.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => UserEntity, (user) => user.tenantMemberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
```

### 2.3 UserEntity (用户)

```typescript
// backend/src/entities/user.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TenantEntity } from './tenant.entity';
import { TenantMemberEntity } from './tenant-member.entity';
import { InterviewSessionEntity } from './interview-session.entity';
import { CaseEntity } from './case.entity';

export enum UserRole {
  ADMIN = 'admin',
  CONSULTANT = 'consultant',
  VIEWER = 'viewer',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['tenantId'])
@Index(['deletedAt'], { where: 'deleted_at IS NULL' })
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CONSULTANT,
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  // 关系
  @ManyToOne(() => TenantEntity, (tenant) => tenant.users, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'tenant_id' })
  defaultTenant: TenantEntity | null;

  @OneToMany(() => TenantMemberEntity, (membership) => membership.user)
  tenantMemberships: TenantMemberEntity[];

  @OneToMany(() => InterviewSessionEntity, (session) => session.interviewer)
  interviewSessions: InterviewSessionEntity[];

  @OneToMany(() => CaseEntity, (caseItem) => caseItem.createdBy)
  createdCases: CaseEntity[];

  @BeforeInsert()
  setDefaultTenantId() {
    // 业务逻辑: 新用户默认tenant_id
    if (!this.tenantId && this.defaultTenant) {
      this.tenantId = this.defaultTenant.id;
    }
  }
}
```

---

## 3. 访谈核心实体

### 3.1 InterviewSessionEntity (访谈会话)

```typescript
// backend/src/entities/interview-session.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';
import { ClientProfileEntity } from './client-profile.entity';
import { RecordingEntity } from './recording.entity';
import { TranscriptionEntity } from './transcription.entity';
import { InsightEntity } from './insight.entity';
import { InterviewDepartmentEntity } from './interview-department.entity';
import { CaseEntity } from './case.entity';

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

@Entity('interview_sessions')
@Index(['tenantId', 'interviewDate'])
@Index(['clientId'])
@Index(['interviewerId'])
@Index(['status'])
@Index(['tenantId', 'status', 'interviewDate'])
export class InterviewSessionEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'client_id', nullable: true })
  clientId: string | null;

  @Column({ type: 'uuid', name: 'interviewer_id', nullable: true })
  interviewerId: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: InterviewStatus, default: InterviewStatus.SCHEDULED })
  status: InterviewStatus;

  @Column({ type: 'timestamptz', name: 'interview_date' })
  interviewDate: Date;

  @Column({ type: 'integer', name: 'planned_duration_minutes', nullable: true })
  plannedDurationMinutes: number | null;

  @Column({ type: 'text', name: 'raw_transcript', nullable: true })
  rawTranscript: string | null;

  @Column({ type: 'jsonb', name: 'structured_summary', nullable: true })
  structuredSummary: {
    sections?: Array<{
      title: string;
      content: string;
      timestamp?: string;
    }>;
    keyPoints?: string[];
    topics?: string[];
  } | null;

  @Column({ type: 'jsonb', name: 'executive_summary', nullable: true })
  executiveSummary: {
    overview?: string;
    keyFindings?: Array<{
      finding: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    recommendations?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  } | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string | null; // 'zh-CN', 'en-US', etc.

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  // 关系
  @ManyToOne(() => TenantEntity, (tenant) => tenant.interviewSessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => ClientProfileEntity, (client) => client.interviewSessions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'client_id' })
  client: ClientProfileEntity | null;

  @ManyToOne(() => UserEntity, (user) => user.interviewSessions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'interviewer_id' })
  interviewer: UserEntity | null;

  @OneToMany(() => RecordingEntity, (recording) => recording.session)
  recordings: RecordingEntity[];

  @OneToMany(() => TranscriptionEntity, (transcription) => transcription.session)
  transcriptions: TranscriptionEntity[];

  @OneToMany(() => InsightEntity, (insight) => insight.session)
  insights: InsightEntity[];

  @OneToMany(() => InterviewDepartmentEntity, (dept) => dept.session)
  departments: InterviewDepartmentEntity[];

  @ManyToOne(() => CaseEntity, (caseItem) => caseItem.interviewSessions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'case_id' })
  caseItem: CaseEntity | null;
}
```

### 3.2 ClientProfileEntity (客户档案)

```typescript
// backend/src/entities/client-profile.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TenantEntity } from './tenant.entity';
import { InterviewSessionEntity } from './interview-session.entity';

@Entity('client_profiles')
@Index(['tenantId', 'email'])
@Index(['tenantId', 'company'])
export class ClientProfileEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null; // 职位

  @Column({ type: 'varchar', length: 100, nullable: true })
  company: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', name: 'last_interview_at', nullable: true })
  lastInterviewAt: Date | null;

  // 关系
  @ManyToOne(() => TenantEntity, (tenant) => tenant.clients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @OneToMany(() => InterviewSessionEntity, (session) => session.client)
  interviewSessions: InterviewSessionEntity[];
}
```

### 3.3 RecordingEntity (录音)

```typescript
// backend/src/entities/recording.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InterviewSessionEntity } from './interview-session.entity';

export enum RecordingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RecordingSource {
  WEB = 'web',
  MOBILE = 'mobile',
  IMPORT = 'import',
  API = 'api',
}

@Entity('recordings')
@Index(['sessionId', 'createdAt'])
@Index(['status'])
export class RecordingEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar', length: 500, name: 'storage_path' })
  storagePath: string; // 腾讯云COS路径

  @Column({ type: 'varchar', length: 50 })
  format: string; // 'mp3', 'wav', 'm4a'

  @Column({ type: 'integer', name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ type: 'bigint', name: 'file_size_bytes' })
  fileSizeBytes: number;

  @Column({
    type: 'enum',
    enum: RecordingStatus,
    default: RecordingStatus.PENDING,
  })
  status: RecordingStatus;

  @Column({
    type: 'enum',
    enum: RecordingSource,
    default: RecordingSource.WEB,
  })
  source: RecordingSource;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'recorded_by' })
  recordedBy: string | null; // 设备ID或用户ID

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  // 关系
  @ManyToOne(() => InterviewSessionEntity, (session) => session.recordings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: InterviewSessionEntity;
}
```

### 3.4 TranscriptionEntity (转录)

```typescript
// backend/src/entities/transcription.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InterviewSessionEntity } from './interview-session.entity';

export enum TranscriptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum TranscriptionEngine {
  TENCENT = 'tencent',
  WHISPER = 'whisper',
  CUSTOM = 'custom',
}

@Entity('transcriptions')
@Index(['sessionId'])
@Index(['status'])
@Index(['sessionId', 'status'])
export class TranscriptionEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'recording_id', nullable: true })
  recordingId: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  segments: Array<{
    startTime: number; // 秒
    endTime: number;
    text: string;
    confidence?: number;
  }> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'speaker_labels' })
  speakerLabels: Array<{
    speaker: string;
    segments: number[]; // segment索引
  }> | null;

  @Column({
    type: 'enum',
    enum: TranscriptionStatus,
    default: TranscriptionStatus.PENDING,
  })
  status: TranscriptionStatus;

  @Column({
    type: 'enum',
    enum: TranscriptionEngine,
    default: TranscriptionEngine.TENCENT,
  })
  engine: TranscriptionEngine;

  @Column({ type: 'decimal', precision: 4, scale: 3, name: 'confidence_score', nullable: true })
  confidenceScore: number | null; // 0.000 - 1.000

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  @Column({ type: 'text', nullable: true })
  rawResponse: string | null; // ASR原始返回

  // 关系
  @ManyToOne(() => InterviewSessionEntity, (session) => session.transcriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: InterviewSessionEntity;
}
```

### 3.5 InsightEntity (洞察)

```typescript
// backend/src/entities/insight.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InterviewSessionEntity } from './interview-session.entity';

export enum InsightCategory {
  PAIN_POINT = 'pain_point',
  NEED = 'need',
  OPPORTUNITY = 'opportunity',
  RISK = 'risk',
  SUGGESTION = 'suggestion',
  INSIGHT = 'insight',
}

export enum InsightStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

@Entity('insights')
@Index(['sessionId', 'category'])
@Index(['category'])
@Index(['status'])
@Index(['tenantId', 'category'])
export class InsightEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({
    type: 'enum',
    enum: InsightCategory,
    default: InsightCategory.INSIGHT,
  })
  category: InsightCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Array<{
    transcriptSegment: string;
    timestamp: string;
    confidence: number;
  }> | null;

  @Column({ type: 'decimal', precision: 4, scale: 3, name: 'confidence_score', nullable: true })
  confidenceScore: number | null;

  @Column({
    type: 'enum',
    enum: InsightStatus,
    default: InsightStatus.PENDING,
  })
  status: InsightStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  // 关系
  @ManyToOne(() => InterviewSessionEntity, (session) => session.insights, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: InterviewSessionEntity;
}
```

---

## 4. 访谈配置实体

### 4.1 InterviewDepartmentEntity (访谈部门)

```typescript
// backend/src/entities/interview-department.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InterviewSessionEntity } from './interview-session.entity';
import { InterviewQuestionEntity } from './interview-question.entity';

@Entity('interview_departments')
@Index(['sessionId', 'sortOrder'])
export class InterviewDepartmentEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // 部门名称

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null; // 部门代码

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  config: {
    estimatedDuration?: number;
    keyFocusAreas?: string[];
    skipConditions?: string[];
  } | null;

  // 关系
  @ManyToOne(() => InterviewSessionEntity, (session) => session.departments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: InterviewSessionEntity;

  @OneToMany(() => InterviewQuestionEntity, (question) => question.department)
  questions: InterviewQuestionEntity[];
}
```

### 4.2 InterviewQuestionEntity (访谈问题)

```typescript
// backend/src/entities/interview-question.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InterviewDepartmentEntity } from './interview-department.entity';

export enum QuestionType {
  OPEN = 'open',
  SINGLE_CHOICE = 'single_choice',
  MULTI_CHOICE = 'multi_choice',
  SCALE = 'scale',
  YES_NO = 'yes_no',
}

export enum QuestionStatus {
  PENDING = 'pending',
  ASKED = 'asked',
  ANSWERED = 'answered',
  SKIPPED = 'skipped',
}

@Entity('interview_questions')
@Index(['departmentId', 'sortOrder'])
export class InterviewQuestionEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'department_id' })
  departmentId: string;

  @Column({ type: 'text' })
  content: string; // 问题内容

  @Column({
    type: 'enum',
    enum: QuestionType,
    default: QuestionType.OPEN,
  })
  type: QuestionType;

  @Column({ type: 'jsonb', nullable: true })
  options: Array<{
    value: string;
    label: string;
    followUp?: string;
  }> | null; // 选项配置

  @Column({ type: 'text', nullable: true })
  hint: string | null; // 追问提示

  @Column({ type: 'boolean', name: 'is_required', default: true })
  isRequired: boolean;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    default: QuestionStatus.PENDING,
  })
  status: QuestionStatus;

  @Column({ type: 'text', nullable: true, name: 'answer_summary' })
  answerSummary: string | null; // AI总结的答案

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  // 关系
  @ManyToOne(() => InterviewDepartmentEntity, (dept) => dept.questions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'department_id' })
  department: InterviewDepartmentEntity;
}
```

---

## 5. 案例库实体

### 5.1 CaseEntity (案例)

```typescript
// backend/src/entities/case.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';
import { CaseFeatureEntity } from './case-feature.entity';
import { InterviewSessionEntity } from './interview-session.entity';

export enum CaseType {
  PROJECT = 'project',
  RESEARCH = 'research',
  INSIGHT = 'insight',
  TEMPLATE = 'template',
}

export enum CaseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('cases')
@Index(['tenantId', 'industry'])
@Index(['tenantId', 'caseType'])
@Index(['isPublic'])
@Index(['status'])
@Index(['tenantId', 'createdAt'])
export class CaseEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry: string | null;

  @Column({
    type: 'enum',
    enum: CaseType,
    default: CaseType.RESEARCH,
  })
  caseType: CaseType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', name: 'is_public', default: false })
  isPublic: boolean;

  @Column({
    type: 'enum',
    enum: CaseStatus,
    default: CaseStatus.DRAFT,
  })
  status: CaseStatus;

  // Vector字段 - 使用自定义类型(见第6节)
  @Column({ type: 'text', name: 'embedding', nullable: true })
  embedding: string | null; // 存储为JSON字符串，查询时转换

  // 关系
  @ManyToOne(() => TenantEntity, (tenant) => tenant.cases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => UserEntity, (user) => user.createdCases, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity | null;

  @OneToMany(() => CaseFeatureEntity, (feature) => feature.case)
  features: CaseFeatureEntity[];

  @OneToMany(() => InterviewSessionEntity, (session) => session.caseItem)
  interviewSessions: InterviewSessionEntity[];
}
```

### 5.2 CaseFeatureEntity (案例要素)

```typescript
// backend/src/entities/case-feature.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { CaseEntity } from './case.entity';

export enum FeatureCategory {
  PAIN_POINT = 'pain_point',
  NEED = 'need',
  SOLUTION = 'solution',
  RESULT = 'result',
  LESSON = 'lesson',
  QUOTE = 'quote',
  DATA = 'data',
}

@Entity('case_features')
@Index(['caseId', 'category'])
@Index(['category'])
export class CaseFeatureEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

  @Column({
    type: 'enum',
    enum: FeatureCategory,
    default: FeatureCategory.INSIGHT,
  })
  category: FeatureCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Array<{
    type: 'quote' | 'data' | 'reference';
    content: string;
    source?: string;
  }> | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, name: 'importance_score', nullable: true })
  importanceScore: number | null; // 0.00 - 1.00

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  // Vector字段
  @Column({ type: 'text', name: 'embedding', nullable: true })
  embedding: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // 关系
  @ManyToOne(() => CaseEntity, (caseItem) => caseItem.features, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  case: CaseEntity;
}
```

---

## 6. 模板实体

### 6.1 TemplateEntity (模板)

```typescript
// backend/src/entities/template.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

export enum TemplateType {
  INTERVIEW = 'interview',
  QUESTIONNAIRE = 'questionnaire',
  OUTLINE = 'outline',
  REPORT = 'report',
}

export enum TemplateScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  PERSONAL = 'personal',
}

@Entity('templates')
@Index(['tenantId', 'templateType'])
@Index(['scope'])
@Index(['isActive'])
export class TemplateEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null; // 模板代码，用于程序引用

  @Column({
    type: 'enum',
    enum: TemplateType,
    default: TemplateType.INTERVIEW,
  })
  templateType: TemplateType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  content: {
    departments?: Array<{
      name: string;
      code?: string;
      description?: string;
      questions?: Array<{
        content: string;
        type: string;
        options?: any[];
        hint?: string;
        isRequired?: boolean;
      }>;
    }>;
    settings?: Record<string, any>;
    styles?: Record<string, any>;
  };

  @Column({
    type: 'enum',
    enum: TemplateScope,
    default: TemplateScope.TENANT,
  })
  scope: TemplateScope;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'jsonb', default: {} })
  variables: Record<string, {
    type: string;
    required: boolean;
    default?: any;
    description?: string;
  }>;

  @Column({ type: 'integer', name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // 关系
  @ManyToOne(() => TenantEntity, (tenant) => tenant.templates, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity | null;

  @ManyToOne(() => UserEntity, (user) => user.createdTemplates, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity | null;
}
```

**注意**: 需要在TenantEntity和UserEntity中添加相应关系:

```typescript
// 添加到 TenantEntity
@OneToMany(() => TemplateEntity, (template) => template.tenant)
templates: TemplateEntity[];

// 添加到 UserEntity
@OneToMany(() => TemplateEntity, (template) => template.creator)
createdTemplates: TemplateEntity[];
```

---

## 7. 审计日志实体

### 7.1 AuditLogEntity (审计日志)

```typescript
// backend/src/entities/audit-log.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  SHARE = 'share',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
}

@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['action'])
@Index(['entityType', 'entityId'])
@Index(['userId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string; // 'interview_session', 'case', 'client', etc.

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  requestId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // 关系 (可选，用于关联查询)
  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;
}
```

**注意**: AuditLogEntity 不使用 BaseEntity，因为它是append-only表，没有updated_at和deleted_at。

---

## 8. pgvector TypeORM类型映射方案

### 8.1 方案一：使用自定义ColumnType (推荐)

```typescript
// backend/src/database/vector-column-type.ts
import { ValueTransformer } from 'typeorm';

/**
 * 向量值转换器
 * 将number[]数组与PostgreSQL vector类型互转
 */
export const VectorTransformer: ValueTransformer = {
  /**
   * 写入数据库时：number[] -> string
   * TypeORM会将其包装为 PostgreSQL数组格式: '{0.1, 0.2, ...}'
   * 我们需要转换为: '[0.1, 0.2, ...]' 格式让PostgreSQL识别为vector
   */
  to: (value: number[] | null): string | null => {
    if (value === null || value === undefined) return null;
    return `[${value.join(',')}]`;
  },

  /**
   * 从数据库读取时：string -> number[]
   * PostgreSQL返回向量格式: '[0.1, 0.2, ...]'
   */
  from: (value: string | null): number[] | null => {
    if (value === null || value === undefined) return null;
    // 去掉方括号并分割
    const clean = value.replace(/[\[\]]/g, '');
    return clean.split(',').map(v => parseFloat(v.trim()));
  },
};
```

在实体中使用：

```typescript
import { VectorTransformer } from '../database/vector-column-type';

@Entity('cases')
export class CaseEntity extends BaseEntity {
  // ... 其他字段

  @Column({
    type: 'text',
    name: 'embedding',
    nullable: true,
    transformer: VectorTransformer,
    comment: '1536维向量，用于语义搜索',
  })
  embedding: number[] | null;
}
```

### 8.2 方案二：使用原始查询 (适用于复杂向量操作)

```typescript
// backend/src/repositories/case.repository.ts
import { Repository, DataSource } from 'typeorm';
import { CaseEntity } from '../entities/case.entity';

export class CaseRepository extends Repository<CaseEntity> {
  constructor(private dataSource: DataSource) {
    super(CaseEntity, dataSource.createEntityManager());
  }

  /**
   * 向量相似度搜索
   * @param tenantId 租户ID
   * @param queryVector 查询向量
   * @param limit 返回数量
   * @param minSimilarity 最小相似度阈值
   */
  async searchSimilar(
    tenantId: string,
    queryVector: number[],
    limit: number = 10,
    minSimilarity: number = 0.8
  ): Promise<Array<CaseEntity & { similarity: number }>> {
    const vectorStr = `[${queryVector.join(',')}]`;

    const results = await this.dataSource.query(
      `
      SELECT
        id,
        tenant_id,
        title,
        industry,
        case_type,
        content,
        summary,
        tags,
        metadata,
        is_public,
        status,
        created_at,
        updated_at,
        deleted_at,
        1 - (embedding <=> $1::vector) AS similarity
      FROM cases
      WHERE tenant_id = $2
        AND is_public = true
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
      `,
      [vectorStr, tenantId, minSimilarity, limit]
    );

    return results.map(row => ({
      ...this.manager.create(CaseEntity, row),
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * 使用IVFFlat索引的近似搜索
   * 注意: 需要预先执行 SET ivfflat.probes = N
   */
  async searchSimilarApproximate(
    tenantId: string,
    queryVector: number[],
    probes: number = 10,
    limit: number = 10
  ): Promise<Array<CaseEntity & { distance: number }>> {
    const vectorStr = `[${queryVector.join(',')}]`;

    // 设置probes参数提高召回率
    await this.dataSource.query(`SET ivfflat.probes = ${probes}`);

    const results = await this.dataSource.query(
      `
      SELECT
        *,
        embedding <=> $1::vector AS distance
      FROM cases
      WHERE tenant_id = $2
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
      [vectorStr, tenantId, limit]
    );

    return results.map(row => ({
      ...this.manager.create(CaseEntity, row),
      distance: parseFloat(row.distance),
    }));
  }

  /**
   * 批量更新embedding
   */
  async updateEmbedding(caseId: string, embedding: number[]): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;

    await this.dataSource.query(
      'UPDATE cases SET embedding = $1::vector WHERE id = $2',
      [vectorStr, caseId]
    );
  }

  /**
   * 案例要素相似度搜索
   */
  async searchSimilarFeatures(
    tenantId: string,
    queryVector: number[],
    category?: string,
    limit: number = 20
  ): Promise<Array<any>> {
    const vectorStr = `[${queryVector.join(',')}]`;

    let sql = `
      SELECT
        cf.id,
        cf.case_id,
        cf.category,
        cf.content,
        cf.summary,
        cf.importance_score,
        c.title as case_title,
        c.industry,
        1 - (cf.embedding <=> $1::vector) AS similarity
      FROM case_features cf
      JOIN cases c ON cf.case_id = c.id
      WHERE c.tenant_id = $2
        AND c.deleted_at IS NULL
        AND cf.embedding IS NOT NULL
    `;

    const params: any[] = [vectorStr, tenantId];

    if (category) {
      sql += ` AND cf.category = $${params.length + 1}`;
      params.push(category);
    }

    sql += `
      ORDER BY cf.embedding <=> $1::vector
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    return await this.dataSource.query(sql, params);
  }
}
```

### 8.3 方案三：使用pgvector-specific装饰器 (需要扩展)

如果需要更优雅的支持，可以创建自定义装饰器：

```typescript
// backend/src/database/vector-column.decorator.ts
import { Column, ColumnOptions } from 'typeorm';
import { VectorTransformer } from './vector-column-type';

interface VectorColumnOptions extends Omit<ColumnOptions, 'type'> {
  dimensions: number;
  nullable?: boolean;
}

/**
 * 向量列装饰器
 * @example
 * @VectorColumn({ dimensions: 1536, nullable: true })
 * embedding: number[] | null;
 */
export function VectorColumn(options: VectorColumnOptions): PropertyDecorator {
  return Column({
    type: 'text', // 实际使用vector，TypeORM中映射为text
    name: options.name,
    nullable: options.nullable ?? false,
    transformer: VectorTransformer,
    comment: `${options.dimensions}维向量`,
  });
}
```

---

## 9. RLS策略与TypeORM配合

### 9.1 PostgreSQL RLS配置

```sql
-- ========================================
-- RLS策略配置脚本 (在schema.sql之后执行)
-- ========================================

-- 1. 创建current_tenant_id函数
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- 从当前会话变量获取
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建is_super_tenant函数
CREATE OR REPLACE FUNCTION is_super_tenant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.is_super_tenant', true) = 'true';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 启用RLS的辅助函数
CREATE OR REPLACE FUNCTION enable_tenant_rls(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
    ALTER TABLE %I FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation_policy ON %I
      FOR ALL
      TO application_user
      USING (
        tenant_id = current_tenant_id()
        OR is_super_tenant()
      )
      WITH CHECK (
        tenant_id = current_tenant_id()
        OR is_super_tenant()
      );
  ', table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- 4. 为所有业务表启用RLS
SELECT enable_tenant_rls('cases');
SELECT enable_tenant_rls('case_features');
SELECT enable_tenant_rls('interview_sessions');
SELECT enable_tenant_rls('client_profiles');
SELECT enable_tenant_rls('recordings');
SELECT enable_tenant_rls('transcriptions');
SELECT enable_tenant_rls('insights');
SELECT enable_tenant_rls('templates');

-- audit_logs表的特殊策略(允许插入，限制查询)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  TO application_user
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  TO application_user
  USING (
    tenant_id = current_tenant_id()
    OR is_super_tenant()
  );

-- tenants表的特殊策略(只能看到自己的租户)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_policy ON tenants
  FOR ALL
  TO application_user
  USING (
    id = current_tenant_id()
    OR is_super_tenant()
  )
  WITH CHECK (
    id = current_tenant_id()
    OR is_super_tenant()
  );
```

### 9.2 TypeORM RLS集成

```typescript
// backend/src/common/interceptors/tenant-context.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    const isSuperTenant = request.user?.role === 'super_admin';

    if (tenantId) {
      // 设置PostgreSQL会话变量
      await this.dataSource.query(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`
      );
      await this.dataSource.query(
        `SET LOCAL app.is_super_tenant = '${isSuperTenant}'`
      );
    }

    return next.handle();
  }
}
```

```typescript
// backend/src/common/guards/tenant.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.params.tenantId || request.body.tenantId;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admin可以访问任何租户
    if (user.role === 'super_admin') {
      await this.setTenantContext(tenantId || user.tenantId, true);
      return true;
    }

    // 检查用户是否有权访问该租户
    if (tenantId && tenantId !== user.tenantId) {
      // 检查用户是否是该租户的成员
      const hasAccess = await this.checkTenantMembership(user.id, tenantId);
      if (!hasAccess) {
        throw new ForbiddenException('No access to this tenant');
      }
    }

    await this.setTenantContext(user.tenantId, false);
    return true;
  }

  private async setTenantContext(
    tenantId: string,
    isSuper: boolean
  ): Promise<void> {
    await this.dataSource.query(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`
    );
    await this.dataSource.query(
      `SET LOCAL app.is_super_tenant = '${isSuper}'`
    );
  }

  private async checkTenantMembership(
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT 1 FROM tenant_members WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );
    return result.length > 0;
  }
}
```

```typescript
// backend/src/common/decorators/set-tenant-context.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * 在方法执行前设置租户上下文
 * 用于需要显式设置tenant_id的场景
 */
export const SetTenantContext = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const dataSource = request.injector.get(DataSource);

    const tenantId = request.user?.tenantId;
    if (tenantId) {
      await dataSource.query(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`
      );
    }

    return tenantId;
  }
);
```

### 9.3 Repository层RLS封装

```typescript
// backend/src/common/repositories/tenant-aware.repository.ts
import { Repository, DataSource, FindManyOptions } from 'typeorm';
import { Injectable } from '@nestjs/common';

/**
 * 租户感知的基础Repository
 * 自动处理tenant_id过滤
 */
@Injectable()
export abstract class TenantAwareRepository<T> extends Repository<T> {
  constructor(
    protected readonly dataSource: DataSource,
    entity: new () => T
  ) {
    super(entity, dataSource.createEntityManager());
  }

  /**
   * 设置当前租户上下文
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.dataSource.query(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`
    );
  }

  /**
   * 在租户上下文中执行查询
   */
  async withTenant<R>(
    tenantId: string,
    operation: () => Promise<R>
  ): Promise<R> {
    await this.setTenantContext(tenantId);
    try {
      return await operation();
    } finally {
      // 清理上下文(可选，取决于事务边界)
      await this.dataSource.query('SET LOCAL app.current_tenant_id = NULL');
    }
  }

  /**
   * 重写find方法，自动添加租户过滤
   */
  async findTenantScoped(
    tenantId: string,
    options?: FindManyOptions<T>
  ): Promise<T[]> {
    await this.setTenantContext(tenantId);
    return this.find(options);
  }
}
```

---

## 10. 模块配置示例

### 10.1 TypeORM模块配置

```typescript
// backend/src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';

// Entities
import { TenantEntity } from '../entities/tenant.entity';
import { UserEntity } from '../entities/user.entity';
import { TenantMemberEntity } from '../entities/tenant-member.entity';
import { InterviewSessionEntity } from '../entities/interview-session.entity';
import { ClientProfileEntity } from '../entities/client-profile.entity';
import { RecordingEntity } from '../entities/recording.entity';
import { TranscriptionEntity } from '../entities/transcription.entity';
import { InsightEntity } from '../entities/insight.entity';
import { InterviewDepartmentEntity } from '../entities/interview-department.entity';
import { InterviewQuestionEntity } from '../entities/interview-question.entity';
import { CaseEntity } from '../entities/case.entity';
import { CaseFeatureEntity } from '../entities/case-feature.entity';
import { TemplateEntity } from '../entities/template.entity';
import { AuditLogEntity } from '../entities/audit-log.entity';

const entities = [
  TenantEntity,
  UserEntity,
  TenantMemberEntity,
  InterviewSessionEntity,
  ClientProfileEntity,
  RecordingEntity,
  TranscriptionEntity,
  InsightEntity,
  InterviewDepartmentEntity,
  InterviewQuestionEntity,
  CaseEntity,
  CaseFeatureEntity,
  TemplateEntity,
  AuditLogEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
```

---

## 11. 索引清单

### 11.1 实体索引汇总

| 实体 | 索引名称 | 字段 | 类型 | 说明 |
|------|----------|------|------|------|
| TenantEntity | idx_tenants_slug | slug | Unique | URL唯一标识 |
| UserEntity | idx_users_email | email | Unique | 登录邮箱唯一 |
| UserEntity | idx_users_tenant_id | tenant_id | B-tree | 租户用户查询 |
| UserEntity | idx_users_deleted_at | deleted_at | Partial | 活跃用户查询 |
| TenantMemberEntity | idx_tenant_members_tenant_user | tenant_id, user_id | Unique | 成员唯一性 |
| InterviewSessionEntity | idx_interview_sessions_tenant_date | tenant_id, interview_date | B-tree | 租户会话列表 |
| InterviewSessionEntity | idx_interview_sessions_client_id | client_id | B-tree | 客户会话查询 |
| InterviewSessionEntity | idx_interview_sessions_interviewer_id | interviewer_id | B-tree | 访谈者查询 |
| InterviewSessionEntity | idx_interview_sessions_status | status | B-tree | 状态过滤 |
| ClientProfileEntity | idx_client_profiles_tenant_email | tenant_id, email | B-tree | 租户客户查询 |
| ClientProfileEntity | idx_client_profiles_tenant_company | tenant_id, company | B-tree | 公司客户查询 |
| RecordingEntity | idx_recordings_session_created | session_id, created_at | B-tree | 会话录音列表 |
| RecordingEntity | idx_recordings_status | status | B-tree | 状态过滤 |
| TranscriptionEntity | idx_transcriptions_session_id | session_id | B-tree | 会话转录查询 |
| TranscriptionEntity | idx_transcriptions_status | status | B-tree | 状态过滤 |
| InsightEntity | idx_insights_session_category | session_id, category | B-tree | 会话洞察分类 |
| InsightEntity | idx_insights_category | category | B-tree | 分类查询 |
| CaseEntity | idx_cases_tenant_industry | tenant_id, industry | B-tree | 行业过滤 |
| CaseEntity | idx_cases_tenant_type | tenant_id, case_type | B-tree | 类型过滤 |
| CaseEntity | idx_cases_is_public | is_public | B-tree | 公开案例查询 |
| CaseEntity | idx_cases_status | status | B-tree | 状态过滤 |
| CaseEntity | idx_cases_embedding_ivfflat | embedding | ivfflat | 向量相似度搜索 |
| CaseFeatureEntity | idx_case_features_case_category | case_id, category | B-tree | 案例要素查询 |
| CaseFeatureEntity | idx_case_features_embedding_ivfflat | embedding | ivfflat | 要素向量搜索 |
| TemplateEntity | idx_templates_tenant_type | tenant_id, template_type | B-tree | 租户模板查询 |
| TemplateEntity | idx_templates_scope | scope | B-tree | 范围过滤 |
| AuditLogEntity | idx_audit_logs_tenant_created | tenant_id, created_at | B-tree | 租户审计日志 |
| AuditLogEntity | idx_audit_logs_action | action | B-tree | 操作类型查询 |
| AuditLogEntity | idx_audit_logs_entity | entity_type, entity_id | B-tree | 实体审计查询 |

---

## 12. 类型定义文件

### 12.1 共享类型 (shared/types)

```typescript
// shared/types/entities.ts

// 枚举定义
export enum UserRole {
  ADMIN = 'admin',
  CONSULTANT = 'consultant',
  VIEWER = 'viewer',
}

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

export enum CaseType {
  PROJECT = 'project',
  RESEARCH = 'research',
  INSIGHT = 'insight',
  TEMPLATE = 'template',
}

export enum InsightCategory {
  PAIN_POINT = 'pain_point',
  NEED = 'need',
  OPPORTUNITY = 'opportunity',
  RISK = 'risk',
  SUGGESTION = 'suggestion',
  INSIGHT = 'insight',
}

// DTO类型
export interface InterviewSessionDto {
  id: string;
  tenantId: string;
  clientId: string | null;
  interviewerId: string | null;
  title: string;
  description: string | null;
  status: InterviewStatus;
  interviewDate: string;
  structuredSummary?: {
    sections?: Array<{
      title: string;
      content: string;
      timestamp?: string;
    }>;
    keyPoints?: string[];
    topics?: string[];
  };
  executiveSummary?: {
    overview?: string;
    keyFindings?: Array<{
      finding: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    recommendations?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
  createdAt: string;
  updatedAt: string;
}

export interface CaseDto {
  id: string;
  tenantId: string;
  createdBy: string | null;
  title: string;
  industry: string | null;
  caseType: CaseType;
  content: string;
  summary: string | null;
  tags: string[];
  isPublic: boolean;
  status: string;
  similarity?: number; // 向量搜索结果
  createdAt: string;
  updatedAt: string;
}
```

---

## 附录：快速参考

### 实体创建顺序 (Migration)

1. `tenants` - 租户
2. `users` - 用户
3. `tenant_members` - 租户成员关系
4. `client_profiles` - 客户档案
5. `interview_sessions` - 访谈会话
6. `recordings` - 录音
7. `transcriptions` - 转录
8. `insights` - 洞察
9. `interview_departments` - 访谈部门
10. `interview_questions` - 访谈问题
11. `cases` - 案例
12. `case_features` - 案例要素
13. `templates` - 模板
14. `audit_logs` - 审计日志

### 常用查询示例

```typescript
// 查询租户下的所有活跃访谈
const sessions = await interviewSessionRepo.find({
  where: {
    tenantId: 'xxx',
    deletedAt: null,
  },
  order: { interviewDate: 'DESC' },
  take: 20,
});

// 查询带客户信息的访谈
const sessionsWithClient = await interviewSessionRepo.find({
  where: { tenantId: 'xxx' },
  relations: ['client', 'interviewer'],
  order: { interviewDate: 'DESC' },
});

// 查询案例及其要素
const caseWithFeatures = await caseRepo.findOne({
  where: { id: 'xxx' },
  relations: ['features', 'creator'],
});
```
