import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Click } from '../analytics/click.entity';

@Entity('urls')
export class Url {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'short_code', type: 'varchar', length: 8, unique: true })
  shortCode: string;

  @Column({ name: 'original_url', type: 'text' })
  originalUrl: string;

  @Column({ type: 'integer', default: 0 })
  clicks: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @OneToMany(() => Click, (click) => click.url)
  clickRecords: Click[];
}
