import {
	AlignmentType,
	HeadingLevel,
	Paragraph,
	Table,
	TableCell,
	TableRow,
	TextRun,
} from "docx";
import {
	DocxSerializer,
	defaultMarks,
	defaultNodes,
	MAX_IMAGE_WIDTH,
} from "prosemirror-docx";

function getAlignment(node: any) {
	const align = node.attrs?.textAlign;
	if (align === "center") return AlignmentType.CENTER;
	if (align === "right") return AlignmentType.RIGHT;
	if (align === "justify") return AlignmentType.BOTH;
	if (align === "left") return AlignmentType.LEFT;
	return undefined;
}

export const customNodes = {
	...defaultNodes,
	horizontalRule: defaultNodes.horizontal_rule,
	hardBreak: defaultNodes.hard_break,
	codeBlock: defaultNodes.code_block,
	orderedList: defaultNodes.ordered_list,
	bulletList: defaultNodes.bullet_list,
	listItem: defaultNodes.list_item,

	// Paragraph & Heading with TextAlign attributes support
	paragraph(state: any, node: any) {
		state.renderInline(node);
		const alignment = getAlignment(node);
		state.closeBlock(node, alignment ? { alignment } : {});
	},
	heading(state: any, node: any) {
		state.renderInline(node);
		const heading =
			[
				HeadingLevel.HEADING_1,
				HeadingLevel.HEADING_2,
				HeadingLevel.HEADING_3,
				HeadingLevel.HEADING_4,
				HeadingLevel.HEADING_5,
				HeadingLevel.HEADING_6,
			][(node.attrs?.level || 1) - 1] || HeadingLevel.HEADING_1;
		const alignment = getAlignment(node);
		state.closeBlock(node, alignment ? { heading, alignment } : { heading });
	},

	// Task List support
	taskList: defaultNodes.bullet_list,
	taskItem(state: any, node: any) {
		const isChecked = node.attrs?.checked ?? false;
		const checkboxChar = isChecked ? "☑ " : "☐ ";
		state.addParagraphOptions({});
		state.current.push(new TextRun({ text: checkboxChar }));
		state.renderContent(node);
	},

	// Tables layout support
	table(state: any, node: any) {
		const actualChildren = state.children;
		const rows: TableRow[] = [];
		node.content.forEach((row: any) => {
			const cells: TableCell[] = [];
			let isHeaderRow = true;
			row.content.forEach((cell: any) => {
				if (
					cell.type.name !== "tableHeader" &&
					cell.type.name !== "table_header"
				) {
					isHeaderRow = false;
				}
			});
			state.maxImageWidth = MAX_IMAGE_WIDTH / (row.content.childCount || 1);
			row.content.forEach((cell: any) => {
				const oldChildren = state.children;
				state.children = [];
				state.renderContent(cell);
				const tableCellOpts: any = { children: state.children };
				const colspan = cell.attrs.colspan ?? 1;
				const rowspan = cell.attrs.rowspan ?? 1;
				if (colspan > 1) tableCellOpts.columnSpan = colspan;
				if (rowspan > 1) tableCellOpts.rowSpan = rowspan;
				cells.push(new TableCell(tableCellOpts));
				state.children = oldChildren;
			});
			rows.push(new TableRow({ children: cells, tableHeader: isHeaderRow }));
		});
		state.maxImageWidth = MAX_IMAGE_WIDTH;
		const table = new Table({ rows });
		actualChildren.push(table);
		actualChildren.push(new Paragraph(""));
		state.children = actualChildren;
	},
	tableRow: () => {},
	tableCell: () => {},
	tableHeader: () => {},
};

export const customMarks = {
	...defaultMarks,
	strike: defaultMarks.strikethrough,
	highlight: (state: any, mark: any) => {
		return { highlight: mark.attrs?.color || "yellow" };
	},
};

export const customSerializer = new DocxSerializer(customNodes, customMarks);
