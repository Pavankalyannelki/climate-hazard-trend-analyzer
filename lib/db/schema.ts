import { bigint, date, doublePrecision, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const climateAnalyses = pgTable('climate_analyses', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  startYear: integer('start_year').notNull(),
  endYear: integer('end_year').notNull(),
  hazard: text('hazard').notNull().default('Heatwave'),
  status: text('status').notNull().default('completed'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const climateDataSources = pgTable('climate_data_sources', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  provider: text('provider').notNull(),
  dataset: text('dataset').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  timezone: text('timezone').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  coverageStart: date('coverage_start').notNull(),
  coverageEnd: date('coverage_end').notNull(),
  quality: jsonb('quality').notNull().default({}),
}, (table) => [unique('climate_data_sources_lookup').on(table.provider, table.dataset, table.latitude, table.longitude, table.coverageStart, table.coverageEnd)])

export const climateObservations = pgTable('climate_observations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  sourceId: bigint('source_id', { mode: 'number' }).notNull(),
  observationDate: date('observation_date').notNull(),
  temperatureMax: doublePrecision('temperature_max'),
  rawPayload: jsonb('raw_payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('climate_observations_lookup').on(table.sourceId, table.observationDate)])

export type ClimateAnalysis = typeof climateAnalyses.$inferSelect
export type NewClimateAnalysis = typeof climateAnalyses.$inferInsert
