import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Fix migration: Add missing is_deleted column to notification table
 * This handles the case where the notification table was created before nc_034 ran
 */
const up = async (knex: Knex) => {
  // Check if notification table exists
  if (await knex.schema.hasTable(MetaTable.NOTIFICATION)) {
    // Check if is_deleted column exists, if not add it
    if (!(await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'is_deleted'))) {
      await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
        table.boolean('is_deleted').defaultTo(false);
      });
    }
  }
};

const down = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTable.NOTIFICATION)) {
    if (await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'is_deleted')) {
      await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
        table.dropColumn('is_deleted');
      });
    }
  }
};

export { up, down };