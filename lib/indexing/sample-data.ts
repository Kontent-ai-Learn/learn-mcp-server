import type { SourceDoc } from "./schema.js";

/**
 * Test/dev fallback content, used by `loadSourceDocs` only when `CONTENT_URL` is unset
 * (production indexes the live endpoint instead). ~20 plain-text docs modelled on
 * Kontent.ai Learn topics, written so hybrid search is demonstrable: exact terms
 * (e.g. "webhook") exercise the lexical half while paraphrases (e.g. "notify an external
 * system when content changes") exercise the semantic half.
 */
export const sampleDocs: readonly SourceDoc[] = [
	{
		id: "content-items",
		title: "Content items",
		url: "https://kontent.ai/learn/content-items",
		markdown:
			"A content item is a single piece of structured content, such as an article, a product, or a landing page. Every content item is based on a content type, which defines the elements it contains. Content items can have multiple language variants, so the same item can hold different text for English, German, or any other configured language. Editors create and edit content items in the content editing application, while developers retrieve them through the Delivery API.",
	},
	{
		id: "content-types",
		title: "Content types",
		url: "https://kontent.ai/learn/content-types",
		markdown:
			"A content type is a reusable blueprint that describes the structure of your content. It is a collection of elements such as text, rich text, number, date and time, asset, linked items, and taxonomy. When you create a content item you choose its content type, and the type determines which elements the editor can fill in. Designing good content types is the foundation of a flexible content model that can be reused across many channels.",
	},
	{
		id: "rich-text-element",
		title: "Rich text element",
		url: "https://kontent.ai/learn/rich-text",
		markdown:
			"The rich text element stores formatted text including headings, lists, links, images, tables, and inline components. Unlike a plain text element, rich text can embed other content items and content components directly inside the flow of text. When you fetch rich text through the Delivery API it is returned as HTML, and any embedded items are described in a separate structure so you can resolve and render them however your front end requires.",
	},
	{
		id: "webhooks",
		title: "Webhooks",
		url: "https://kontent.ai/learn/webhooks",
		markdown:
			"Webhooks let you notify an external system whenever content changes in your project. When a triggering event occurs, such as a content item being published or unpublished, Kontent.ai sends an HTTP POST request to the URL you configured. This lets you rebuild a static site, invalidate a cache, or synchronize data to another service automatically. Each webhook delivery is signed so the receiver can verify the payload really came from Kontent.ai.",
	},
	{
		id: "webhook-security",
		title: "Securing webhook notifications",
		url: "https://kontent.ai/learn/webhook-security",
		markdown:
			"Every webhook request includes a signature in the X-KC-Signature header. To protect your endpoint you should compute an HMAC-SHA256 hash of the raw request body using your webhook secret and compare it with the signature header. If the values do not match, reject the request. Always validate the signature before acting on a notification so attackers cannot trigger your integration with forged payloads.",
	},
	{
		id: "delivery-api",
		title: "Delivery API",
		url: "https://kontent.ai/learn/delivery-api",
		markdown:
			"The Delivery API is a read-only REST API that serves your published content to websites and applications. It returns content items, content types, taxonomies, and assets as JSON. The API is backed by a global CDN, so responses are fast and cached close to your users. Use the Delivery Preview API with a preview API key when you need to retrieve unpublished content for a staging environment.",
	},
	{
		id: "management-api",
		title: "Management API",
		url: "https://kontent.ai/learn/management-api",
		markdown:
			"The Management API is a read-write API for programmatically creating and updating content, content types, taxonomies, assets, and other project objects. Unlike the read-only Delivery API, it requires a secure Management API key and is intended for migrations, bulk imports, and automation. Use it to seed a new project, integrate with external systems, or build custom editing tools.",
	},
	{
		id: "taxonomy",
		title: "Taxonomy",
		url: "https://kontent.ai/learn/taxonomy",
		markdown:
			"Taxonomies let you categorize and tag content items so they can be filtered and grouped. A taxonomy group contains a tree of terms, for example a Topics group with terms like Marketing, Engineering, and Design. You add a taxonomy element to a content type and editors then pick the relevant terms. Developers can filter content in the Delivery API by taxonomy terms to build navigation, related-content lists, and faceted search.",
	},
	{
		id: "languages",
		title: "Languages and localization",
		url: "https://kontent.ai/learn/languages",
		markdown:
			"Kontent.ai supports multilingual content through language variants. You configure the languages your project needs and every content item can have a separate variant per language. Languages can fall back to a default language so untranslated content still appears. When calling the Delivery API you specify the language so the response contains the right translation for your audience.",
	},
	{
		id: "workflow",
		title: "Workflow and publishing",
		url: "https://kontent.ai/learn/workflow",
		markdown:
			"A workflow describes the steps a content item moves through before it goes live, such as Draft, Review, and Published. You can define custom workflow steps and control who is allowed to move content between them. Only content in the published step is served by the Delivery API. Scheduled publishing lets you set a future date and time when an item should automatically become live.",
	},
	{
		id: "assets",
		title: "Assets and the Asset library",
		url: "https://kontent.ai/learn/assets",
		markdown:
			"The asset library stores binary files such as images, videos, and documents. Each asset can have descriptive metadata and can be referenced from asset elements or embedded in rich text. Images served from the asset CDN can be transformed on the fly using query parameters to resize, crop, and change format, which helps you deliver responsive images optimized for each device.",
	},
	{
		id: "linked-items",
		title: "Linked items element",
		url: "https://kontent.ai/learn/linked-items",
		markdown:
			"The linked items element creates relationships between content items by referencing other items. It is how you compose pages from reusable building blocks, for example a landing page that links to several feature sections. When you retrieve content from the Delivery API, linked items are returned in a modular_content structure that you resolve to render the full page.",
	},
	{
		id: "preview",
		title: "Content preview",
		url: "https://kontent.ai/learn/preview",
		markdown:
			"Preview lets editors see how unpublished content will look on the live site before it is published. You configure a preview URL for a content type and use the Delivery Preview API together with a preview API key to fetch the latest draft content. This gives writers confidence that their changes render correctly without affecting the production audience.",
	},
	{
		id: "sdks",
		title: "SDKs and developer tools",
		url: "https://kontent.ai/learn/sdks",
		markdown:
			"Kontent.ai provides software development kits for popular languages and frameworks including JavaScript and TypeScript, .NET, PHP, Java, and others. The SDKs wrap the Delivery and Management APIs with strongly typed models, so you can fetch and map content without hand-writing HTTP requests. They also include helpers for resolving rich text, linked items, and image transformations.",
	},
	{
		id: "content-modeling",
		title: "Content modeling best practices",
		url: "https://kontent.ai/learn/content-modeling",
		markdown:
			"Content modeling is the process of deciding how to structure your content into types and elements. Favor small, reusable types over large monolithic ones, name elements clearly, and model content for reuse across channels rather than for a single page layout. A well-designed model makes content easier to author, translate, and deliver to web, mobile, and other touchpoints.",
	},
	{
		id: "roles-permissions",
		title: "Roles and permissions",
		url: "https://kontent.ai/learn/roles",
		markdown:
			"Roles control what each user can do in a project. You can grant fine-grained permissions to view, create, edit, or publish content, and scope those permissions to specific languages or content types. Assign roles so that contributors only access what they need, reviewers can approve content, and administrators manage project settings.",
	},
	{
		id: "collections",
		title: "Collections",
		url: "https://kontent.ai/learn/collections",
		markdown:
			"Collections partition content within a single project, which is useful when one project serves several brands, regions, or business units. Each content item belongs to a collection, and permissions can be granted per collection. This lets multiple teams share content types and taxonomies while keeping their own content separate and secure.",
	},
	{
		id: "custom-elements",
		title: "Custom elements",
		url: "https://kontent.ai/learn/custom-elements",
		markdown:
			"Custom elements let you extend the content editor with your own UI when the built-in elements are not enough. A custom element is a small web application hosted by you and embedded in an iframe inside the editing app. Use them to integrate third-party data, build specialized pickers, or provide tailored editing experiences while still storing the value in the content item.",
	},
	{
		id: "image-transformation",
		title: "Image transformation API",
		url: "https://kontent.ai/learn/image-transformation",
		markdown:
			"Images stored as assets can be resized, cropped, and reformatted directly from the URL using the Image Transformation API. By appending query parameters you can request a specific width and height, change the output format to WebP, adjust quality, and apply automatic device-pixel-ratio scaling. This avoids storing many versions of the same image and helps pages load faster.",
	},
	{
		id: "content-components",
		title: "Content components",
		url: "https://kontent.ai/learn/content-components",
		markdown:
			"Content components are single-use building blocks that live inside a rich text element. Unlike linked content items, a component is not reusable and exists only within the item that contains it. Components are ideal for one-off structured pieces inside an article, such as a call-out box or an embedded chart, that you do not want cluttering the list of reusable content items.",
	},
];
