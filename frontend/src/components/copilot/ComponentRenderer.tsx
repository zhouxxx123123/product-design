/**
 * ComponentRenderer — maps a ToolCall to a pre-built component variant.
 * Delegates to DynamicRenderer for `generated` type.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Search,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type {
  ToolCall,
  ToolCallState,
  ConfirmFormComponent,
  ResultCardComponent,
  SearchResultsComponent,
  NavButtonComponent,
  GeneratedComponent,
  ConfirmFormField,
} from '../../types/copilot';
import DynamicRenderer from './DynamicRenderer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ComponentRendererProps {
  toolCall: ToolCall;
  state: ToolCallState;
  onConfirm: (formData: Record<string, unknown>) => void;
  onCancel: () => void;
}

// ── Card wrapper ──

interface CardProps {
  children: React.ReactNode;
  cancelled?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, cancelled, className }) => (
  <div
    className={cn(
      'bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm',
      cancelled && 'opacity-50',
      className,
    )}
  >
    {children}
  </div>
);

// ── ConfirmForm ──

interface ConfirmFormProps {
  component: ConfirmFormComponent;
  state: ToolCallState;
  onConfirm: (formData: Record<string, unknown>) => void;
  onCancel: () => void;
}

const ConfirmForm: React.FC<ConfirmFormProps> = ({
  component,
  state,
  onConfirm,
  onCancel,
}) => {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      component.fields.map((f) => [f.name, f.defaultValue ?? '']),
    ),
  );

  const setField = (name: string, val: unknown) =>
    setValues((prev) => ({ ...prev, [name]: val }));

  const renderField = (field: ConfirmFormField) => {
    const base =
      'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white disabled:bg-slate-50 disabled:text-slate-400';
    const disabled = state === 'executing' || state === 'done';
    const val = String(values[field.name] ?? '');

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={val}
            disabled={disabled}
            onChange={(e) => setField(field.name, e.target.value)}
            rows={3}
            className={cn(base, 'resize-none')}
          />
        );
      case 'select':
        return (
          <select
            value={val}
            disabled={disabled}
            onChange={(e) => setField(field.name, e.target.value)}
            className={base}
          >
            <option value="">请选择…</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={val}
            disabled={disabled}
            onChange={(e) => setField(field.name, e.target.value)}
            className={base}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={val}
            disabled={disabled}
            onChange={(e) => setField(field.name, e.target.value)}
            className={base}
          />
        );
      default:
        return (
          <input
            type="text"
            value={val}
            disabled={disabled}
            onChange={(e) => setField(field.name, e.target.value)}
            className={base}
          />
        );
    }
  };

  return (
    <Card cancelled={state === 'cancelled'}>
      <h4 className="text-sm font-semibold text-slate-800">{component.title}</h4>

      <div className="space-y-3">
        {component.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>

      {state !== 'done' && (
        <div className="flex gap-2 pt-1">
          {state === 'executing' ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              执行中…
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={state === 'cancelled'}
                onClick={() => onConfirm(values)}
                className="flex-1 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                确认
              </button>
              <button
                type="button"
                disabled={state === 'cancelled'}
                onClick={onCancel}
                className="flex-1 py-2 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
            </>
          )}
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium pt-1">
          <CheckCircle className="w-4 h-4" />
          已完成
        </div>
      )}
    </Card>
  );
};

// ── ResultCard ──

interface ResultCardProps {
  component: ResultCardComponent;
}

const ResultCard: React.FC<ResultCardProps> = ({ component }) => {
  const navigate = useNavigate();

  const handleAction = (url: string) => {
    if (url.startsWith('/')) {
      navigate(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card>
      <div>
        <h4 className="text-sm font-semibold text-slate-800">{component.title}</h4>
        {component.subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{component.subtitle}</p>
        )}
      </div>

      {component.attributes.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {component.attributes.map((attr) => (
            <div key={attr.label}>
              <dt className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                {attr.label}
              </dt>
              <dd className="text-xs text-slate-700 font-medium mt-0.5">{attr.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {component.actions && component.actions.length > 0 && (
        <div className="flex gap-2 pt-1 flex-wrap">
          {component.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => handleAction(action.url)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                action.variant === 'secondary'
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700',
              )}
            >
              {action.label}
              {action.url.startsWith('/') ? (
                <ArrowRight className="w-3 h-3" />
              ) : (
                <ExternalLink className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

// ── SearchResults ──

interface SearchResultsProps {
  component: SearchResultsComponent;
}

const SearchResults: React.FC<SearchResultsProps> = ({ component }) => {
  const navigate = useNavigate();

  const handleClick = (url?: string) => {
    if (!url) return;
    if (url.startsWith('/')) {
      navigate(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold text-slate-800">{component.title}</h4>
      </div>

      {component.items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">
          {component.emptyText ?? '未找到相关结果'}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {component.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item.url)}
              className={cn(
                'w-full flex items-center gap-3 py-2.5 text-left transition-colors',
                item.url
                  ? 'hover:bg-slate-50 cursor-pointer'
                  : 'cursor-default',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.meta && (
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {item.meta}
                  </span>
                )}
                {item.url && (
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

// ── NavButton ──

interface NavButtonProps {
  component: NavButtonComponent;
}

const NavButton: React.FC<NavButtonProps> = ({ component }) => {
  const navigate = useNavigate();

  return (
    <Card>
      <button
        type="button"
        onClick={() => navigate(component.path)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm"
      >
        <span>{component.label}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
      {component.description && (
        <p className="text-xs text-slate-500 text-center">{component.description}</p>
      )}
    </Card>
  );
};

// ── GeneratedComponent renderer ──

interface GeneratedRendererProps {
  component: GeneratedComponent;
  onSubmit: (data: Record<string, unknown>) => void;
}

const GeneratedComponentRenderer: React.FC<GeneratedRendererProps> = ({
  component,
  onSubmit,
}) => {
  if (!component.schema) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          正在生成组件…
        </div>
        {component.description && (
          <p className="text-xs text-slate-400">{component.description}</p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <DynamicRenderer schema={component.schema} onSubmit={onSubmit} />
    </Card>
  );
};

// ── ComponentRenderer (main export) ──

const ComponentRenderer: React.FC<ComponentRendererProps> = ({
  toolCall,
  state,
  onConfirm,
  onCancel,
}) => {
  const { component } = toolCall;

  switch (component.type) {
    case 'confirm_form':
      return (
        <ConfirmForm
          component={component}
          state={state}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

    case 'result_card':
      return <ResultCard component={component} />;

    case 'search_results':
      return <SearchResults component={component} />;

    case 'nav_button':
      return <NavButton component={component} />;

    case 'generated':
      return (
        <GeneratedComponentRenderer
          component={component}
          onSubmit={onConfirm}
        />
      );

    default: {
      const _exhaustive: never = component;
      void _exhaustive;
      return (
        <Card>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <XCircle className="w-4 h-4" />
            未知组件类型
          </div>
        </Card>
      );
    }
  }
};

export default ComponentRenderer;
