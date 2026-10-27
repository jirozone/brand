// Validates tokens.json: every colour is HSL channels ("H S% L%"), the shape the consuming
// apps' drift tests expect. Run in CI on every push.
import { readFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'));
const CHANNELS = /^\d{1,3}(\.\d+)? \d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/;

const errors = [];
if (typeof tokens.font?.sans !== 'string') errors.push('font.sans must be a string');
if (!/^\d+(\.\d+)?rem$/.test(tokens.radius ?? '')) errors.push(`radius: "${tokens.radius}" is not a rem length`);
for (const [name, value] of Object.entries(tokens.color ?? {})) {
	if (!/^[a-z]+(-[a-z]+)*$/.test(name)) errors.push(`color.${name}: name must be kebab-case`);
	if (typeof value !== 'string' || !CHANNELS.test(value))
		errors.push(`color.${name}: "${value}" is not HSL channels like "240 100% 9%"`);
}

if (errors.length) {
	console.error(errors.join('\n'));
	process.exit(1);
}
console.log(`tokens.json OK (${Object.keys(tokens.color).length} colours)`);
