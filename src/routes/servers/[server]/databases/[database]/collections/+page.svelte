<script lang="ts">
	import { dropCollection as dropCollectionCommand } from "$api/servers.remote";
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Modal from "$lib/components/Modal.svelte";
	import Panel from "$lib/components/Panel.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { formatBytes, formatNumber } from "$lib/utils/filters";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	type Collection = PageData["collections"][number];

	let showDropModal = $state(false);
	let collectionToDrop = $state<Collection | null>(null);
	let isDropping = $state(false);

	let sortColumn = $state<"name" | "count" | "size">("name");
	let sortAsc = $state(true);

	function toggleSort(col: "name" | "count" | "size") {
		if (sortColumn === col) {
			sortAsc = !sortAsc;
		} else {
			sortColumn = col;
			sortAsc = true;
		}
	}

	let sortedCollections = $derived(
		[...data.collections].sort((a, b) => {
			let cmp = 0;
			if (sortColumn === "name") {
				cmp = a.name.localeCompare(b.name);
			} else if (sortColumn === "count") {
				cmp = a.count - b.count;
			} else if (sortColumn === "size") {
				cmp = a.size - b.size;
			}
			return sortAsc ? cmp : -cmp;
		}),
	);

	function openDropModal(collection: Collection) {
		collectionToDrop = collection;
		showDropModal = true;
	}

	function closeDropModal() {
		showDropModal = false;
		collectionToDrop = null;
		isDropping = false;
	}

	async function confirmDrop() {
		if (!collectionToDrop || isDropping) {
			return;
		}

		isDropping = true;
		try {
			await dropCollectionCommand({
				server: data.server,
				database: data.database,
				collection: collectionToDrop.name,
			});
			notificationStore.notifySuccess(`Collection "${collectionToDrop.name}" dropped successfully`);
			closeDropModal();
			// Reload the page to get updated collections
			await invalidateAll();
		} catch (error) {
			notificationStore.notifyError(error, "Failed to drop collection");
			isDropping = false;
		}
	}
</script>

<Panel title="{data.database} collections">
	<table class="table">
		<thead>
			<tr>
				<th class="sortable" onclick={() => toggleSort("name")}>
					Name {sortColumn === "name" ? (sortAsc ? "▲" : "▼") : ""}
				</th>
				<th class="sortable" onclick={() => toggleSort("count")}>
					Documents {sortColumn === "count" ? (sortAsc ? "▲" : "▼") : ""}
				</th>
				<th class="sortable" onclick={() => toggleSort("size")}>
					Size {sortColumn === "size" ? (sortAsc ? "▲" : "▼") : ""}
				</th>
				<th>Type</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#if sortedCollections && sortedCollections.length > 0}
				{#each sortedCollections as collection (collection.name)}
					<tr class="group">
						<td>
							<a
								href={resolve(
									`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
										data.database,
									)}/collections/${encodeURIComponent(collection.name)}/documents`,
								)}
							>
								{collection.name}
							</a>
						</td>
						<td>
							{formatNumber(collection.count)}
						</td>
						<td>
							{formatBytes(collection.size)}
						</td>
						<td>
							{collection.type ?? "collection"}
						</td>
						<td style="width: 180px">
							<div class="flex gap-2 justify-end">
								<a
									class="btn btn-default btn-sm -my-2 hidden group-hover:inline"
									href={resolve(
										`/servers/${encodeURIComponent(data.server)}/databases/${encodeURIComponent(
											data.database,
										)}/collections/${encodeURIComponent(collection.name)}/export`,
									)}
									download
								>
									Export
								</a>
								{#if !data.readOnly}
									<button
										class="btn btn-outline-danger btn-sm -my-2 hidden group-hover:inline"
										onclick={() => openDropModal(collection)}
									>
										Drop
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			{:else}
				<tr>
					<td colspan="5">
						<div class="text-center">No collections...</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</Panel>

<Modal show={showDropModal} onclose={closeDropModal} title="Drop Collection">
	<p>
		Are you sure you want to drop the collection <strong>{collectionToDrop?.name}</strong>? This action cannot be
		undone.
	</p>
	{#snippet footer()}
		<button class="btn btn-default btn-sm" onclick={closeDropModal} disabled={isDropping}>Cancel</button>
		<button class="btn btn-outline-danger btn-sm" onclick={confirmDrop} disabled={isDropping}>
			{#if isDropping}
				Dropping...
			{:else}
				Drop Collection
			{/if}
		</button>
	{/snippet}
</Modal>

<style>
	.sortable {
		cursor: pointer;
		user-select: none;
	}
	.sortable:hover {
		opacity: 0.7;
	}
</style>
