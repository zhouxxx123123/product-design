import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

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

/**
 * 访谈问题实体
 */
@Entity('interview_questions')
@Index(['department_id', 'sort_order'])
export class InterviewQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'department_id' })
  departmentId: string;

  @Column({ type: 'text' })
  content: string;

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
  }> | null;

  @Column({ type: 'text', nullable: true })
  hint: string | null;

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
  answerSummary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

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
