/**
 * Airtable client helper.
 *
 * Today this is a transparent passthrough to fetch(). The query-param
 * injection is staged but disabled until every literal-name read in the
 * codebase migrates to FIELDS-based access (see lib/airtable/constants.ts
 * comment for why).
 *
 * When the full ID migration is ready, flip ENABLE_FIELD_IDS to true and
 * verify the test plan: every Airtable read path renders data correctly.
 *
 * Usage:
 *   import { airtableFetch } from '@/lib/airtable/client'
 *   const res = await airtableFetch(url, { headers: ... })
 */

const ENABLE_FIELD_IDS = true

/** Appends `returnFieldsByFieldId=true` to an Airtable URL. */
export function withFieldIds(url: string): string {
  if (!ENABLE_FIELD_IDS) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}returnFieldsByFieldId=true`
}

/**
 * Drop-in replacement for fetch() for Airtable calls. Currently transparent;
 * will inject `returnFieldsByFieldId=true` when ENABLE_FIELD_IDS flips.
 */
export function airtableFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(withFieldIds(url), init)
}
