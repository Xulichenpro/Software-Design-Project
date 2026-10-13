import type { EditRecord } from '../records/EditRecord.js';
import type { CommandResult } from '../contracts/CommandResult.js';
export interface EditOutcome<R extends EditRecord<unknown>> { readonly result: CommandResult; readonly record: R; }

