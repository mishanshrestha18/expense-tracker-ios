/**
 * Committed costs: rent, the car, the subscriptions — money that leaves
 * whether or not anyone opens the app. An amount is a timeline rather than a
 * single number, so "rent goes up in October 2027" is one extra row entered
 * today (see `docs/design/committed-costs.md`).
 */
import type { IsoDate } from '@/domain/dates';

import type {
  Commitment,
  CommitmentAmount,
  CommitmentInput,
  CommitmentKind,
  CommitmentSettlement,
  Db,
} from './types';

interface CommitmentRow {
  id: number;
  name: string;
  category_id: number;
  kind: string;
  due_day: number;
  every_months: number;
  anchor_month: string;
  ended_on: string | null;
}

interface AmountRow {
  commitment_id: number;
  effective_from: string;
  amount_pence: number;
}

interface SettlementRow {
  commitment_id: number;
  due_on: string;
  status: string;
  expense_id: number | null;
}

const COLUMNS = 'id, name, category_id, kind, due_day, every_months, anchor_month, ended_on';

const AMOUNT_COLUMNS = 'commitment_id, effective_from, amount_pence';

const toCommitment = (row: CommitmentRow, amounts: CommitmentAmount[]): Commitment => ({
  id: row.id,
  name: row.name,
  categoryId: row.category_id,
  kind: row.kind as CommitmentKind,
  dueDay: row.due_day,
  everyMonths: row.every_months,
  anchorMonth: row.anchor_month,
  endedOn: row.ended_on,
  amounts,
});

const toAmount = (row: AmountRow): CommitmentAmount => ({
  effectiveFrom: row.effective_from,
  amountPence: row.amount_pence,
});

const toSettlement = (row: SettlementRow): CommitmentSettlement => ({
  commitmentId: row.commitment_id,
  dueOn: row.due_on,
  status: row.status as CommitmentSettlement['status'],
  expenseId: row.expense_id,
});

const params = (input: CommitmentInput) => [
  input.name.trim(),
  input.categoryId,
  input.kind,
  input.dueDay,
  input.everyMonths,
  input.anchorMonth,
  input.endedOn,
];

/** Every commitment with its amounts, oldest first and the ended ones last. */
export async function listCommitments(db: Db): Promise<Commitment[]> {
  const rows = await db.getAllAsync<CommitmentRow>(
    `SELECT ${COLUMNS} FROM commitments ORDER BY (ended_on IS NOT NULL), id`,
    [],
  );
  const amounts = await db.getAllAsync<AmountRow>(
    `SELECT ${AMOUNT_COLUMNS} FROM commitment_amounts ORDER BY effective_from`,
    [],
  );

  const byCommitment = new Map<number, CommitmentAmount[]>();
  for (const row of amounts) {
    const timeline = byCommitment.get(row.commitment_id) ?? [];
    timeline.push(toAmount(row));
    byCommitment.set(row.commitment_id, timeline);
  }
  return rows.map((row) => toCommitment(row, byCommitment.get(row.id) ?? []));
}

export async function getCommitment(db: Db, id: number): Promise<Commitment | null> {
  const row = await db.getFirstAsync<CommitmentRow>(
    `SELECT ${COLUMNS} FROM commitments WHERE id = ?`,
    [id],
  );
  if (!row) return null;

  const amounts = await db.getAllAsync<AmountRow>(
    `SELECT ${AMOUNT_COLUMNS} FROM commitment_amounts
     WHERE commitment_id = ?
     ORDER BY effective_from`,
    [id],
  );
  return toCommitment(row, amounts.map(toAmount));
}

/**
 * Writes the commitment and the amount it starts on together, because a
 * commitment with no amount cannot be costed. Returns the new id.
 */
export async function addCommitment(
  db: Db,
  input: CommitmentInput,
  amountPence: number,
  effectiveFrom: IsoDate,
): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO commitments
         (name, category_id, kind, due_day, every_months, anchor_month, ended_on)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params(input),
    );
    id = result.lastInsertRowId;
    await db.runAsync(`INSERT INTO commitment_amounts (${AMOUNT_COLUMNS}) VALUES (?, ?, ?)`, [
      id,
      effectiveFrom,
      amountPence,
    ]);
  });
  return id;
}

/** Changes the commitment itself; the amount timeline is edited separately. */
export async function updateCommitment(db: Db, id: number, input: CommitmentInput): Promise<void> {
  await db.runAsync(
    `UPDATE commitments
     SET name = ?, category_id = ?, kind = ?, due_day = ?, every_months = ?, anchor_month = ?,
         ended_on = ?
     WHERE id = ?`,
    [...params(input), id],
  );
}

/** Deletes the commitment along with its amounts and settlements. */
export async function deleteCommitment(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM commitments WHERE id = ?', [id]);
}

/** Creates or replaces the amount that applies from `effectiveFrom` onwards. */
export async function setCommitmentAmount(
  db: Db,
  id: number,
  effectiveFrom: IsoDate,
  amountPence: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO commitment_amounts (${AMOUNT_COLUMNS}) VALUES (?, ?, ?)
     ON CONFLICT (commitment_id, effective_from)
       DO UPDATE SET amount_pence = excluded.amount_pence`,
    [id, effectiveFrom, amountPence],
  );
}

export async function removeCommitmentAmount(
  db: Db,
  id: number,
  effectiveFrom: IsoDate,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM commitment_amounts WHERE commitment_id = ? AND effective_from = ?',
    [id, effectiveFrom],
  );
}

/** Settlements due from `start` (inclusive) to `end` (exclusive), oldest first. */
export async function listSettlements(
  db: Db,
  start: IsoDate,
  end: IsoDate,
): Promise<CommitmentSettlement[]> {
  const rows = await db.getAllAsync<SettlementRow>(
    `SELECT commitment_id, due_on, status, expense_id FROM commitment_settlements
     WHERE due_on >= ? AND due_on < ?
     ORDER BY due_on, commitment_id`,
    [start, end],
  );
  return rows.map(toSettlement);
}

/** Records what happened to one occurrence, replacing any earlier answer. */
export async function settleCommitment(db: Db, settlement: CommitmentSettlement): Promise<void> {
  await db.runAsync(
    `INSERT INTO commitment_settlements (commitment_id, due_on, status, expense_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (commitment_id, due_on) DO UPDATE SET
       status = excluded.status,
       expense_id = excluded.expense_id,
       recorded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [settlement.commitmentId, settlement.dueOn, settlement.status, settlement.expenseId],
  );
}

export async function unsettleCommitment(
  db: Db,
  commitmentId: number,
  dueOn: IsoDate,
): Promise<void> {
  await db.runAsync('DELETE FROM commitment_settlements WHERE commitment_id = ? AND due_on = ?', [
    commitmentId,
    dueOn,
  ]);
}
