import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Migration: Transform old notification table schema to new schema
 * Old schema: to_user_id, from_user_id, message, message_i18n, created_time
 * New schema: fk_user_id, body, created_at, updated_at
 */
const up = async (knex: Knex) => {
  if (!(await knex.schema.hasTable(MetaTable.NOTIFICATION))) {
    // Table doesn't exist, nc_034 will create it
    return;
  }

  const hasOldSchema =
    (await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'to_user_id')) &&
    !(await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'fk_user_id'));

  if (!hasOldSchema) {
    // Already has new schema or doesn't exist
    return;
  }

  // Transform old schema to new schema
  // Step 1: Add new columns
  if (!(await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'fk_user_id'))) {
    await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
      table.string('fk_user_id', 20);
    });
  }

  if (!(await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'body'))) {
    await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
      table.text('body');
    });
  }

  if (!(await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'created_at'))) {
    await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasColumn(MetaTable.NOTIFICATION, 'updated_at'))) {
    await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Step 2: Migrate data from old columns to new columns
  // Use to_user_id as fk_user_id (notifications are sent to users)
  await knex.raw(`
    UPDATE ${MetaTable.NOTIFICATION}
    SET fk_user_id = to_user_id
    WHERE fk_user_id IS NULL AND to_user_id IS NOT NULL
  `);

  // Migrate message to body (prefer message_i18n if available, otherwise message)
  await knex.raw(`
    UPDATE ${MetaTable.NOTIFICATION}
    SET body = COALESCE(message_i18n, message)
    WHERE body IS NULL AND (message IS NOT NULL OR message_i18n IS NOT NULL)
  `);

  // Migrate created_time to created_at
  await knex.raw(`
    UPDATE ${MetaTable.NOTIFICATION}
    SET created_at = created_time
    WHERE created_at IS NULL AND created_time IS NOT NULL
  `);

  // Set updated_at to created_at if not set
  await knex.raw(`
    UPDATE ${MetaTable.NOTIFICATION}
    SET updated_at = COALESCE(created_at, NOW())
    WHERE updated_at IS NULL
  `);

  // Step 3: Make new columns required and add indexes
  await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
    table.string('fk_user_id', 20).notNullable().alter();
    table.index('fk_user_id');
    table.index('created_at');
  });

  // Step 4: Drop old columns (optional - can be done later if needed)
  // Keeping old columns for now to avoid data loss
};

const down = async (_knex: Knex) => {
  // Reverse migration if needed
  // For now, we'll keep both schemas
};

export { up, down };