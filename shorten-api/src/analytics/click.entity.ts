import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Url } from '../url/url.entity';

@Entity('clicks')
export class Click {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'url_id' })
  @Index()
  urlId: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'text', nullable: true })
  referer: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  @Index()
  country: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  @Index()
  createdAt: Date;

  @ManyToOne(() => Url, (url) => url.clickRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'url_id' })
  url: Url;
}
