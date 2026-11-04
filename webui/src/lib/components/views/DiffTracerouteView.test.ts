import { fromJson, type JsonObject } from '@bufbuild/protobuf';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import * as Pb from '@as203038/lg-protobuf/lookingglass/v0/lookingglass_pb';
import DiffTracerouteView from './DiffTracerouteView.svelte';

const a = (rttMs: number): JsonObject => ({ ip: '192.0.2.1', hostname: 'rtr-a.example', rttMs });
const b = (rttMs: number): JsonObject => ({ ip: '192.0.2.5', hostname: '192.0.2.5', rttMs });
const lost: JsonObject = { ip: '', hostname: '', rttMs: 0 };

// Each argument is one hop: its TTL is its position.
const trace = (...hops: JsonObject[][]) =>
	fromJson(Pb.TracerouteParsedSchema, {
		target: '203.0.113.10',
		hops: hops.map((probes, i) => ({ ttl: i + 1, probes }))
	});

// Returns each body row as [ttl, diff, old hosts, new hosts, RTTs], with the lines of a cell joined by " / ".
function renderRows(oldTp: Pb.TracerouteParsed, newTp: Pb.TracerouteParsed): string[][] {
	const { container } = render(DiffTracerouteView, { oldTp, newTp });
	return Array.from(container.querySelectorAll('tbody tr'), (tr) =>
		Array.from(tr.querySelectorAll('td'), (td) => {
			const spans = Array.from(td.querySelectorAll('span'), (s) => s.textContent!.trim());
			return spans.length ? spans.join(' / ') : td.textContent!.trim();
		})
	);
}

describe('DiffTracerouteView', () => {
	it('does not mark a hop when only the RTT is different', () => {
		const rows = renderRows(trace([a(1.5), a(2.5), a(3.5)]), trace([a(1.25), a(2.25), a(3.25)]));
		expect(rows).toEqual([
			['1', '', 'rtr-a.example', 'rtr-a.example', '1.25 ms / 2.25 ms / 3.25 ms']
		]);
	});

	it('lists each responder once and does not mark another probe order', () => {
		const rows = renderRows(trace([a(1.5), b(2.5), b(3.5)]), trace([b(1.5), a(2.5), a(3.5)]));
		expect(rows).toEqual([
			[
				'1',
				'',
				'rtr-a.example / 192.0.2.5',
				'192.0.2.5 / rtr-a.example',
				'1.5 ms / 2.5 ms / 3.5 ms'
			]
		]);
	});

	it('marks a hop when another router answers, with the old and new RTTs', () => {
		const rows = renderRows(trace([a(1.5), a(2.5)]), trace([a(1.25), b(2.25)]));
		expect(rows).toEqual([
			[
				'1',
				'~',
				'rtr-a.example',
				'rtr-a.example / 192.0.2.5',
				'1.5 ms / 2.5 ms / 1.25 ms / 2.25 ms'
			]
		]);
	});

	it('does not mark a hop when a probe of the same router is lost', () => {
		const rows = renderRows(trace([a(1.5), a(2.5), a(3.5)]), trace([a(1.5), lost, a(3.5)]));
		expect(rows).toEqual([['1', '', 'rtr-a.example', 'rtr-a.example', '1.5 ms / * / 3.5 ms']]);
	});

	it('shows * once for a hop that no probe answered', () => {
		const rows = renderRows(trace([lost, lost, lost]), trace([lost, lost, lost]));
		expect(rows).toEqual([['1', '', '*', '*', '* / * / *']]);
	});

	it('marks a hop that starts to answer', () => {
		const rows = renderRows(trace([lost, lost]), trace([lost, a(2.5)]));
		expect(rows).toEqual([['1', '~', '*', 'rtr-a.example', '* / * / * / 2.5 ms']]);
	});

	it('marks a hop that only one run has', () => {
		expect(renderRows(trace([a(1.5)]), trace([a(1.5)], [b(2.5)]))).toEqual([
			['1', '', 'rtr-a.example', 'rtr-a.example', '1.5 ms'],
			['2', '+', '', '192.0.2.5', '2.5 ms']
		]);
		expect(renderRows(trace([a(1.5)], [b(2.5)]), trace([a(1.5)]))).toEqual([
			['1', '', 'rtr-a.example', 'rtr-a.example', '1.5 ms'],
			['2', '-', '192.0.2.5', '', '2.5 ms']
		]);
	});
});
