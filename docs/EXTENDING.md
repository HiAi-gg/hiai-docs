# Extending HiAi-Docs

HiAi-Docs exposes additive, typed frontend extension points for product builds
and submodule consumers. Use them to add product features without copying a
route, sidebar, dashboard, editor, or authentication flow.

Extensions cannot replace authentication, permissions, retrieval, GraphRAG,
storage, or standard editor behavior. The base application remains the owner of
all document infrastructure and UI flows.

## Public hosts

The public hosts preserve the standalone routes and provide named extension
zones:

| Host | Extensions it consumes | Use it for |
|---|---|---|
| `HiaiDocsDashboardHost` | `dashboardWidgets` | Usage, templates, classification widgets |
| `HiaiDocsSearchHost` | `searchWidgets` | Product context next to read-only search state |
| Built-in sidebar | `navigation` | Templates, Billing, Usage links |
| Built-in Settings dialog | `settingsSections` | Product-owned settings tabs |
| Built-in document editor | `editorActions`, `documentTabs` | AI actions and HTML rendition tabs |

Hosts are SvelteKit components. They intentionally use the normal `$app` and
`$lib` runtime, so consume them from a SvelteKit product build rather than a
framework-agnostic widget environment.

## Extension provider

Import from the stable public package path:

```svelte
<script lang="ts">
  import {
    HiaiDocsDashboardHost,
    HiaiDocsExtensionProvider,
  } from "@hiai-gg/hiai-docs/frontend/hosts";
  import UsageWidget from "./UsageWidget.svelte";

  const extensions = {
    dashboardWidgets: [
      {
        id: "product-usage",
        component: UsageWidget,
        order: 20,
      },
    ],
    navigation: [
      {
        id: "templates",
        label: "Templates",
        href: "/templates",
        order: 20,
      },
    ],
  };
</script>

<HiaiDocsExtensionProvider {extensions}>
  <HiaiDocsDashboardHost {data} />
</HiaiDocsExtensionProvider>
```

The provider creates a request-scoped manifest. With no provider, each host
uses an empty manifest and renders the unchanged standalone HiAi-Docs UI.
Extension ids are deterministic, visibility predicates are isolated, and a
failing visibility predicate is hidden rather than breaking the base UI.

## Editor controls

For a simple typed action, add `editorActions` to the manifest. The action gets
the document id, current Markdown and JSON, selection, and a deliberately small
editor-command facade.

For an existing rich Svelte control such as an AI dropdown or voice input, use
the existing `toolbarExtensions` snippet on `HiAiEditor`. It is additive and
continues to render after the built-in formatting controls.

```svelte
<HiAiEditor bind:content={content} documentId="doc-123">
  {#snippet toolbarExtensions({ editor })}
    <button type="button" onclick={() => editor?.chain().focus().run()}>
      Ask AI
    </button>
  {/snippet}
</HiAiEditor>
```

## Document tabs

Add product tabs through the provider manifest. New integrations must not use
the legacy module-level tab registry; it remains only for existing submodule
consumers.

```svelte
<script lang="ts">
  import { HiaiDocsExtensionProvider } from "@hiai-gg/hiai-docs/frontend/hosts";
  import HtmlPreviewPanel from "./HtmlPreviewPanel.svelte";
  import CodeIcon from "lucide-svelte/icons/code";

  const extensions = {
    documentTabs: [
      {
        id: "html-preview",
        label: "HTML View",
        component: HtmlPreviewPanel,
        order: 10,
        icon: CodeIcon,
      },
    ],
  };
</script>

<HiaiDocsExtensionProvider {extensions}>
  {@render children()}
</HiaiDocsExtensionProvider>
```

Tab panels receive:

```ts
interface DocTabPanelProps {
  documentId: string;
  content: string;
  contentJson: object | undefined;
}
```

## Integration rules

1. Keep all extension components and product data in the consuming project.
2. Import only documented public entrypoints, never a private HiAi-Docs route
   or internal store.
3. Use existing HiAi-Docs design tokens and compact accessible controls.
4. Keep Markdown and the structured TipTap JSON equivalent when adding editor
   nodes so sharing and export continue to work.
5. Treat `@hiai-gg/hiai-docs/frontend/hosts` and
   `@hiai-gg/hiai-docs/frontend/extensions` as semver-versioned public APIs.
