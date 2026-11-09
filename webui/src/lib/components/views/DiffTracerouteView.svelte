<script lang="ts">
	import type { Pb } from '$lib/grpc';

	interface Props {
		oldTp: Pb.TracerouteParsed;
		newTp: Pb.TracerouteParsed;
	}
	let { oldTp, newTp }: Props = $props();

	interface DiffHop {
		ttl: number;
		old?: Pb.TracerouteHop;
		new?: Pb.TracerouteHop;
		status: 'added' | 'removed' | 'changed' | 'unchanged';
	}

	interface ProbeLine {
		id: string;
		label: string;
		rtts: string[];
	}

	/** One line per responder (its IP, else its hostname) with its RTTs, then one '*' line for lost probes. */
	function probeLines(h: Pb.TracerouteHop): ProbeLine[] {
		const lines = new Map<string, ProbeLine>();
		const lost: ProbeLine = { id: '', label: '*', rtts: [] };
		for (const p of h.probes) {
			const id = p.ip || p.hostname;
			if (!id) {
				lost.rtts.push('*');
				continue;
			}
			const label = p.hostname && p.hostname !== p.ip ? p.hostname : p.ip;
			let line = lines.get(id);
			if (!line) lines.set(id, (line = { id, label, rtts: [] }));
			line.rtts.push(p.rttMs + ' ms');
		}
		return lost.rtts.length || !lines.size ? [...lines.values(), lost] : [...lines.values()];
	}

	const maxTtl = $derived(
		Math.max(
			oldTp.hops.length ? oldTp.hops[oldTp.hops.length - 1].ttl : 0,
			newTp.hops.length ? newTp.hops[newTp.hops.length - 1].ttl : 0
		)
	);

	const rows = $derived.by(() => {
		const oldMap = new Map(oldTp.hops.map((h) => [h.ttl, h]));
		const newMap = new Map(newTp.hops.map((h) => [h.ttl, h]));
		const arr: DiffHop[] = [];

		for (let ttl = 1; ttl <= maxTtl; ttl++) {
			const o = oldMap.get(ttl);
			const n = newMap.get(ttl);
			if (!o && !n) continue;

			if (o && !n) arr.push({ ttl, old: o, status: 'removed' });
			else if (!o && n) arr.push({ ttl, new: n, status: 'added' });
			else if (o && n) {
				// RTT is different on each run: only another set of responders changes the hop.
				const key = (h: Pb.TracerouteHop) =>
					probeLines(h)
						.map((l) => l.id)
						.filter(Boolean)
						.sort()
						.join('|');
				arr.push({ ttl, old: o, new: n, status: key(o) === key(n) ? 'unchanged' : 'changed' });
			}
		}
		return arr;
	});
</script>

<div class="flex-1 overflow-auto bg-(--color-bg-base)">
	<table class="w-full font-mono text-xs">
		<thead
			class="sticky top-0"
			style="background-color: var(--color-bg-inset); color: var(--color-fg-subtle);"
		>
			<tr class="text-left">
				<th class="w-8 px-3 py-2 font-normal">#</th>
				<th class="px-3 py-2 font-normal">Diff</th>
				<th class="px-3 py-2 font-normal">Host (Old)</th>
				<th class="px-3 py-2 font-normal">Host (New)</th>
				<th class="px-3 py-2 text-right font-normal">RTT</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.ttl)}
				<tr
					class="border-t *:align-top"
					style="border-color: var(--color-border); background-color: {r.status === 'added'
						? 'color-mix(in oklab, var(--color-success) 10%, transparent)'
						: r.status === 'removed'
							? 'color-mix(in oklab, var(--color-danger) 10%, transparent)'
							: r.status === 'changed'
								? 'color-mix(in oklab, var(--color-warning) 10%, transparent)'
								: 'transparent'};"
				>
					<td class="px-3 py-1.5 text-right whitespace-nowrap" style="color: var(--color-fg-muted);"
						>{r.ttl}</td
					>
					<td class="px-3 py-1.5 font-bold whitespace-nowrap">
						{#if r.status === 'added'}<span style="color: var(--color-success)">+</span>
						{:else if r.status === 'removed'}<span style="color: var(--color-danger)">-</span>
						{:else if r.status === 'changed'}<span style="color: var(--color-warning)">~</span>
						{/if}
					</td>
					<td class="px-3 py-1.5 whitespace-nowrap opacity-70">
						{#if r.old}
							<div class="flex flex-col">
								{#each probeLines(r.old) as l (l.id)}
									<span>{l.label}</span>
								{/each}
							</div>
						{/if}
					</td>
					<td class="px-3 py-1.5 whitespace-nowrap">
						{#if r.new}
							<div class="flex flex-col">
								{#each probeLines(r.new) as l (l.id)}
									<span>{l.label}</span>
								{/each}
							</div>
						{/if}
					</td>
					<td class="px-3 py-1.5 text-right whitespace-nowrap">
						{#if r.status === 'changed'}
							<!-- Side by side: each line is level with its responder in the old or new host column. -->
							<div class="flex items-start justify-end gap-4">
								<div class="flex flex-col items-end line-through opacity-50">
									{#each probeLines(r.old!) as l (l.id)}
										<span>{l.rtts.join(' ') || '*'}</span>
									{/each}
								</div>
								<div class="flex flex-col items-end text-(--color-success)">
									{#each probeLines(r.new!) as l (l.id)}
										<span>{l.rtts.join(' ') || '*'}</span>
									{/each}
								</div>
							</div>
						{:else}
							<div class="flex flex-col items-end">
								{#each probeLines((r.new || r.old)!) as l (l.id)}
									<span>{l.rtts.join(' ') || '*'}</span>
								{/each}
							</div>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
