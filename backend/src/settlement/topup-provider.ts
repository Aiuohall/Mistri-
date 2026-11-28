import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export interface Topup {
  id: string;
  mechanic_id: string;
  amount: number;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
}

export abstract class TopupProvider {
  abstract submit(
    tx: EntityManager,
    mechanicId: string,
    amount: number,
    reference: string,
  ): Promise<Topup>;
}

@Injectable()
export class ManualBkashProvider implements TopupProvider {
  async submit(tx: EntityManager, mechanicId: string, amount: number, reference: string) {
    const normalized = reference.toUpperCase();
    await tx.query(
      'INSERT INTO wallet_topups(mechanic_id,amount,reference) VALUES($1,$2,$3) ON CONFLICT(reference) DO NOTHING',
      [mechanicId, amount, normalized],
    );
    const [row] = await tx.query<Topup[]>('SELECT * FROM wallet_topups WHERE reference=$1', [
      normalized,
    ]);
    if (!row || row.mechanic_id !== mechanicId || row.amount !== amount) {
      throw new ConflictException('Transfer reference already submitted.');
    }
    return row;
  }
}
