// @vitest-environment node
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: import.meta.dirname });

// Returns the no-restricted-syntax messages that start with prefix.
async function ruleHits(mustache: string, prefix: string): Promise<number> {
	const code = `<script lang="ts">\n\tlet { p, hasReply }: { p: { ip: string; hostname: string; rttMs: number; lossPct: number }; hasReply: boolean } = $props();\n\tconst float32 = (v: number) => String(v);\n</script>\n\n<span>${mustache}</span>\n`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/components/views/DiffTracerouteView.svelte'
	});
	return result.messages.filter(
		(m) => m.ruleId === 'no-restricted-syntax' && m.message.startsWith(prefix)
	).length;
}

const floatRuleHits = (mustache: string) => ruleHits(mustache, 'An *Ms or *Pct field');
const lostProbeRuleHits = (mustache: string) => ruleHits(mustache, 'An RTT of 0 is a reply');

describe('the *Ms / *Pct display rule', () => {
	beforeAll(async () => {
		await floatRuleHits('{0}');
	}, 30_000);

	it.each([
		'{p.rttMs}',
		"{p.rttMs + ' ms'}",
		'{`${p.rttMs} ms`}',
		"{hasReply ? p.rttMs : '*'}",
		"{hasReply ? '*' : p.rttMs}",
		"{String(hasReply) + (hasReply ? p.rttMs : '*')}",
		'{p.lossPct}',
		"{p.lossPct + '%'}",
		'{`${p.lossPct}%`}'
	])('rejects %s', async (mustache) => {
		expect(await floatRuleHits(mustache)).toBe(1);
	});

	it.each([
		"{float32(p.rttMs) + ' ms'}",
		"{p.rttMs > 0 ? float32(p.rttMs) + ' ms' : '*'}",
		"{p.rttMs ? float32(p.rttMs) + ' ms' : '*'}",
		'{(hasReply ? p.rttMs : 0).toFixed(3)}',
		"{float32(hasReply ? p.rttMs : 0) + ' ms'}",
		"{float32(p.lossPct) + '%'}",
		'{p.lossPct.toFixed(0)}%'
	])('accepts %s', async (mustache) => {
		expect(await floatRuleHits(mustache)).toBe(0);
	});
});

describe('the lost-probe rule', () => {
	it.each([
		"{p.rttMs > 0 ? float32(p.rttMs) + ' ms' : '*'}",
		'{#if p.rttMs > 0}x{/if}',
		'{#if 0 < p.rttMs}x{/if}',
		'{#if p.rttMs === 0}x{/if}'
	])('rejects %s', async (mustache) => {
		expect(await lostProbeRuleHits(mustache)).toBe(1);
	});

	it.each(["{#if p.ip || p.hostname}{float32(p.rttMs) + ' ms'}{/if}"])(
		'accepts %s',
		async (mustache) => {
			expect(await lostProbeRuleHits(mustache)).toBe(0);
		}
	);
});
