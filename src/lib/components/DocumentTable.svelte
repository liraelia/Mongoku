<script lang="ts">
	import { goto } from "$app/navigation";
	import { base } from "$app/paths";
	import type { MongoDocument } from "$lib/types";

	let {
		items,
		server,
		database,
		collection,
	}: {
		items: MongoDocument[];
		server: string;
		database: string;
		collection: string;
	} = $props();

	let columns = $derived.by(() => {
		const seen = new Set<string>();
		const cols: string[] = [];
		for (const doc of items) {
			for (const key of Object.keys(doc ?? {})) {
				if (!seen.has(key)) {
					seen.add(key);
					cols.push(key);
				}
			}
		}
		// Keep _id first, preserve first-seen order otherwise (stable sort)
		return cols.sort((a, b) => (a === "_id" ? -1 : b === "_id" ? 1 : 0));
	});

	function idValue(doc: MongoDocument): string | null {
		const id = doc?._id as unknown;
		if (id == null) {
			return null;
		}
		if (typeof id === "object" && "$value" in (id as Record<string, unknown>)) {
			return String((id as Record<string, unknown>).$value);
		}
		return String(id);
	}

	function rowHref(doc: MongoDocument): string | null {
		const id = idValue(doc);
		if (id == null) {
			return null;
		}
		return `${base}/servers/${encodeURIComponent(server)}/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}`;
	}

	function formatCell(value: unknown): { text: string; muted: boolean } {
		if (value === undefined) {
			return { text: "", muted: true };
		}
		if (value === null) {
			return { text: "null", muted: true };
		}
		if (typeof value === "object") {
			const v = value as Record<string, unknown>;
			if (typeof v.$type === "string") {
				switch (v.$type) {
					case "ObjectId":
					case "Decimal128":
						return { text: String(v.$value), muted: false };
					case "Date":
						return { text: formatDate(v.$value), muted: false };
					case "Binary":
						return { text: "Binary", muted: true };
					case "RegExp": {
						const rv = v.$value as { $pattern?: string; $flags?: string };
						return { text: `/${rv?.$pattern ?? ""}/${rv?.$flags ?? ""}`, muted: false };
					}
				}
			}
			if (Array.isArray(value)) {
				return { text: `[ ${value.length} ]`, muted: true };
			}
			const n = Object.keys(v).length;
			return { text: `{ ${n} field${n === 1 ? "" : "s"} }`, muted: true };
		}
		if (typeof value === "string") {
			return { text: value, muted: value.length === 0 };
		}
		return { text: String(value), muted: false };
	}

	function formatDate(v: unknown): string {
		try {
			return new Date(String(v)).toLocaleString();
		} catch {
			return String(v);
		}
	}

	function openRow(doc: MongoDocument) {
		const href = rowHref(doc);
		if (href) {
			/* eslint-disable-next-line svelte/no-navigation-without-resolve */
			goto(href);
		}
	}
</script>

<div class="overflow-x-auto rounded-xl border border-[var(--border-color)]">
	<table class="w-full border-collapse text-[13px]" style="color: var(--text);">
		<thead>
			<tr>
				{#each columns as col (col)}
					<th
						class="sticky top-0 whitespace-nowrap border-b border-[var(--border-color)] bg-[var(--light-background)] px-3 py-2 text-left font-semibold"
					>
						{col}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each items as doc, i (idValue(doc) ?? i)}
				{@const href = rowHref(doc)}
				<tr
					class="border-b border-[var(--border-color)] {href ? 'cursor-pointer hover:bg-[var(--color-3)]/40' : ''}"
					onclick={() => openRow(doc)}
				>
					{#each columns as col (col)}
						{@const cell = formatCell((doc as Record<string, unknown>)?.[col])}
						<td
							class="max-w-[400px] truncate whitespace-nowrap px-3 py-1.5 font-mono"
							style={cell.muted ? "color: var(--text-secondary);" : ""}
							title={cell.text}
						>
							{cell.text}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
