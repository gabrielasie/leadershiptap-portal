import Airtable from "airtable";
import type { Base } from "airtable";

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey) throw new Error("Missing AIRTABLE_API_KEY env variable");
if (!baseId) throw new Error("Missing AIRTABLE_BASE_ID env variable");

console.log("[Airtable] Using base ID:", baseId);

const airtable = new Airtable({ apiKey });

const base: Base = airtable.base(baseId);

export default base;
