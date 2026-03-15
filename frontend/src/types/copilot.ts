/**
 * Copilot AI-driven UI system types.
 *
 * The Copilot dialog communicates over a Server-Sent Events (SSE) stream.
 * The AI may return two kinds of events:
 *   - `data:`       — plain text delta chunks (streaming text)
 *   - `event: tool_call` — a structured {@link ToolCall} JSON payload that
 *                          instructs the UI to render an interactive component.
 */

// ── Intent & Risk ──

/** The action the AI wants the UI to perform on behalf of the user. */
export type ToolCallIntent =
  | 'create_session'
  | 'search_cases'
  | 'navigate'
  | 'generate_outline'
  | 'custom_component'
  | 'search_clients'
  | 'create_template';

/**
 * Risk level of the tool call.
 * - `'low'`  — can be auto-executed without an explicit user confirmation step.
 * - `'high'` — must be confirmed by the user before execution.
 */
export type ToolCallRisk = 'low' | 'high';

// ── Component Types ──

/** Discriminant used to narrow {@link ToolCallComponent} to a concrete variant. */
export type ComponentType =
  | 'confirm_form'
  | 'result_card'
  | 'search_results'
  | 'nav_button'
  | 'generated';

// ── ConfirmFormField ──

/** A single field descriptor within a {@link ConfirmFormComponent}. */
export interface ConfirmFormField {
  /** Machine-readable key; maps to the request body field name. */
  name: string;
  /** Human-readable label shown in the form UI. */
  label: string;
  /** The HTML input variant to render. */
  type: 'text' | 'textarea' | 'select' | 'number' | 'date';
  /** When `true` the form cannot be submitted with this field empty. */
  required?: boolean;
  /** Choices available for `type === 'select'` fields. */
  options?: Array<{ label: string; value: string }>;
  /** Pre-populated value shown when the form is first rendered. */
  defaultValue?: string | number;
}

// ── ToolCallComponent discriminated union ──

/**
 * A form that collects user input before performing a write operation.
 * Shown when the AI needs confirmation of parameters before executing
 * an action such as creating a session or template.
 */
export interface ConfirmFormComponent {
  type: 'confirm_form';
  /** Form heading displayed at the top of the component. */
  title: string;
  /** Ordered list of fields to render. */
  fields: ConfirmFormField[];
  /**
   * Target API route invoked on submit, e.g. `"POST /api/v1/sessions"`.
   * The DynamicRenderer is responsible for parsing and calling this endpoint.
   */
  action: string;
  /** Pre-filled payload merged with user input before submission. */
  data?: Record<string, unknown>;
}

/**
 * A read-only card summarising a single entity (e.g. a client or case).
 * May include quick-action buttons that link to related views.
 */
export interface ResultCardComponent {
  type: 'result_card';
  /** Primary heading of the card. */
  title: string;
  /** Secondary line shown below the title. */
  subtitle?: string;
  /** Key-value pairs rendered as a description list. */
  attributes: Array<{ label: string; value: string }>;
  /** Optional CTAs rendered at the bottom of the card. */
  actions?: Array<{
    label: string;
    url: string;
    variant?: 'primary' | 'secondary';
  }>;
}

/**
 * A list of search results returned by the AI after a lookup operation.
 * Each item can link to a detail view via `url`.
 */
export interface SearchResultsComponent {
  type: 'search_results';
  /** Heading for the result list. */
  title: string;
  /** The matched items to display. */
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    /** Short metadata string, e.g. a date or tag. */
    meta?: string;
    /** Optional deep-link URL for the item. */
    url?: string;
  }>;
  /** Message shown when `items` is empty. */
  emptyText?: string;
}

/**
 * A single navigation affordance rendered as a button or list item.
 * Used when the AI wants to guide the user to a specific view.
 */
export interface NavButtonComponent {
  type: 'nav_button';
  /** Button text. */
  label: string;
  /** Explanatory sentence shown beneath the button label. */
  description?: string;
  /** React Router path to push onto the history stack. */
  path: string;
  /** Name of a Lucide icon to render alongside the label. */
  icon?: string;
}

/**
 * A component whose exact structure is generated at runtime from a
 * natural-language description. The `schema` field is `undefined` until
 * the generation engine resolves it.
 */
export interface GeneratedComponent {
  type: 'generated';
  /** Natural-language prompt used to generate the component. */
  description: string;
  /**
   * Resolved layout schema populated by the component generation engine
   * after processing `description`. Absent until generation completes.
   */
  schema?: ComponentSchema;
}

/** Discriminated union of all renderable Copilot component variants. */
export type ToolCallComponent =
  | ConfirmFormComponent
  | ResultCardComponent
  | SearchResultsComponent
  | NavButtonComponent
  | GeneratedComponent;

// ── ComponentSchema (DynamicRenderer) ──

/** Layout strategy applied to the root container of a generated component. */
export type ComponentLayout = 'list' | 'grid' | 'form' | 'table' | 'card';

/** Interaction type of a toolbar or submit action. */
export type SchemaActionType =
  | 'append_item'
  | 'delete_item'
  | 'submit'
  | 'navigate'
  | 'api_call';

/** A single interactive action a generated component can trigger. */
export interface SchemaAction {
  type: SchemaActionType;
  /** Button / menu label shown in the UI. */
  label: string;
  /**
   * Target API endpoint including method and path template,
   * e.g. `"POST /api/v1/sessions/{id}/outline"`.
   */
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
}

/** The primitive display/input type for a single schema item. */
export type SchemaItemType =
  | 'text_input'
  | 'textarea'
  | 'badge'
  | 'checkbox'
  | 'rating'
  | 'date_display';

/** Descriptor for a repeatable row or field in a generated component. */
export interface SchemaItem {
  type: SchemaItemType;
  /** Optional label rendered above or beside the element. */
  label?: string;
  /** Key used to read/write this value in the data binding context. */
  field?: string;
  /** When `true` a delete affordance is rendered on the item. */
  deletable?: boolean;
  /** When `true` the item must be filled before submission. */
  required?: boolean;
}

/**
 * Resolved layout description produced by the component generation engine
 * and consumed by the DynamicRenderer to build the component tree at runtime.
 */
export interface ComponentSchema {
  layout: ComponentLayout;
  /** When `true` the list/grid items can be reordered via drag-and-drop. */
  draggable?: boolean;
  /** Optional heading rendered above the component. */
  title?: string;
  /** Template for repeating items (list / grid layouts). */
  items?: SchemaItem;
  /** Column definitions for `layout === 'table'`. */
  columns?: Array<{
    key: string;
    label: string;
    type?: SchemaItemType;
  }>;
  /** Actions placed in the component toolbar. */
  toolbar?: SchemaAction[];
  /** Primary submit action (form / table layouts). */
  submit?: SchemaAction;
}

// ── ToolCall ──

/**
 * The structured payload carried by an `event: tool_call` SSE event.
 * The Copilot dialog renders the appropriate component based on
 * `component.type` and blocks execution of high-risk intents until
 * the user explicitly confirms.
 */
export interface ToolCall {
  intent: ToolCallIntent;
  risk: ToolCallRisk;
  /** The UI component the AI wants to render. */
  component: ToolCallComponent;
  /**
   * Optional companion text message displayed alongside the component,
   * e.g. "I found 3 matching clients. Here are the results:".
   */
  text?: string;
}

// ── CopilotMessage ──

/**
 * Lifecycle state of a tool-call message.
 *
 * | State        | Meaning                                                  |
 * |--------------|----------------------------------------------------------|
 * | `pending`    | Component rendered, awaiting user confirmation           |
 * | `confirmed`  | User approved, execution not yet started                 |
 * | `executing`  | API call / navigation in progress                        |
 * | `done`       | Execution completed; `toolCallResult` is populated       |
 * | `cancelled`  | User dismissed the component without confirming          |
 */
export type ToolCallState =
  | 'pending'
  | 'confirmed'
  | 'executing'
  | 'done'
  | 'cancelled';

/**
 * Extended message model for the CopilotDialog that adds first-class
 * support for structured tool-call events alongside plain text.
 *
 * When `type === 'text'` only `content` is meaningful.
 * When `type === 'tool_call'` the `toolCall` field is populated and
 * `content` may contain the companion text (or be an empty string).
 */
export interface CopilotMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  /** Plain text content. Empty string when the message is tool_call-only. */
  content: string;
  type: 'text' | 'tool_call';
  /** Populated when `type === 'tool_call'`. */
  toolCall?: ToolCall;
  /** Tracks the execution lifecycle of a tool call message. */
  toolCallState?: ToolCallState;
  /** The API response payload after the tool call executes successfully. */
  toolCallResult?: Record<string, unknown>;
}
