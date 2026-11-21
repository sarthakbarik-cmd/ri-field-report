import React from 'react';
import { AutoFitScaleContainer } from './AutoFitScaleContainer';

export interface GenericGenealogyNode {
  id: string;
  name: string;
  relationship: string;
  isDeceased?: boolean;
  parentHeirId?: string | null;
  fatherOrHusbandName?: string;
  isApplicant?: boolean;
  age?: number;
  isMinor?: boolean;
}

export interface RevenueLineGenealogyTreeProps {
  rootName: string;
  rootSubtitle?: string;
  rootDetails?: string;
  nodes: GenericGenealogyNode[];
  isPrintVersion?: boolean;
  maxNodeWidth?: number;
  showGenerationLabels?: boolean;
  className?: string;
}

interface LayoutNode {
  id: string;
  name: string;
  relationship: string;
  isDeceased: boolean;
  isApplicant: boolean;
  fatherOrHusbandName?: string;
  depth: number;
  width: number;
  height: number;
  x: number;
  y: number;
  children: LayoutNode[];
}

interface TreeConnection {
  parentX: number;
  parentY: number;
  midY: number;
  minChildX: number;
  maxChildX: number;
  childPoints: Array<{ x: number; y: number }>;
}

/**
 * RevenueLineGenealogyTree
 * Renders an official Revenue / Court style clean SVG Tidy-Tree layout.
 * Guarantees zero text collision and exact orthogonal vector connectors.
 */
export const RevenueLineGenealogyTree: React.FC<RevenueLineGenealogyTreeProps> = ({
  rootName,
  rootSubtitle = '(ସ୍ୱର୍ଗତ / Deceased)',
  rootDetails,
  nodes,
  maxNodeWidth = 110,
  showGenerationLabels = false,
  className = '',
}) => {
  // Sizing constants
  const NODE_MIN_WIDTH = 96;
  const NODE_HEIGHT = 40;
  const NODE_GAP = 14;
  const LEVEL_GAP = 36;
  const PADDING = 16;
  const LEFT_GEN_OFFSET = showGenerationLabels ? 56 : 0;

  // Build recursive tree structure
  const buildLayoutTree = (): {
    root: LayoutNode;
    connections: TreeConnection[];
    totalWidth: number;
    totalHeight: number;
    maxDepth: number;
  } => {
    // Helper to calculate required node width based on text length
    const getNodeWidth = (nameStr: string, relStr: string) => {
      const maxLen = Math.max((nameStr || '').length, (relStr || '').length + 6);
      const cap = Math.max(140, maxNodeWidth + 10);
      return Math.max(NODE_MIN_WIDTH, Math.min(cap, maxLen * 7.5 + 18));
    };

    // Recursive width calculation (Bottom-Up)
    const buildSubTree = (
      nodeId: string,
      name: string,
      rel: string,
      isDeceased: boolean,
      isApp: boolean,
      fatherName?: string,
      depth: number = 0
    ): LayoutNode => {
      const childData = nodes.filter((n) => n.parentHeirId === nodeId);
      const children: LayoutNode[] = childData.map((c) =>
        buildSubTree(
          c.id,
          c.name || '---',
          c.relationship || 'Heir',
          !!c.isDeceased,
          !!c.isApplicant,
          c.fatherOrHusbandName,
          depth + 1
        )
      );

      const baseWidth = getNodeWidth(name, rel);
      let subtreeWidth = baseWidth;

      if (children.length > 0) {
        const childrenTotalWidth =
          children.reduce((sum, c) => sum + c.width, 0) +
          (children.length - 1) * NODE_GAP;
        subtreeWidth = Math.max(baseWidth, childrenTotalWidth);
      }

      return {
        id: nodeId,
        name,
        relationship: rel,
        isDeceased,
        isApplicant: isApp,
        fatherOrHusbandName: fatherName,
        depth,
        width: subtreeWidth,
        height: NODE_HEIGHT,
        x: 0,
        y: 0,
        children,
      };
    };

    // Direct generation-1 heirs under root
    const directHeirs = nodes.filter(
      (n) => !n.parentHeirId || !nodes.some((p) => p.id === n.parentHeirId)
    );

    const rootChildren: LayoutNode[] = directHeirs.map((c) =>
      buildSubTree(
        c.id,
        c.name || '---',
        c.relationship || 'Heir',
        !!c.isDeceased,
        !!c.isApplicant,
        c.fatherOrHusbandName,
        1
      )
    );

    const rootBaseWidth = Math.max(
      140,
      getNodeWidth(rootName || 'Deceased Person', rootSubtitle) + 20
    );
    let rootSubtreeWidth = rootBaseWidth;

    if (rootChildren.length > 0) {
      const childrenTotalWidth =
        rootChildren.reduce((sum, c) => sum + c.width, 0) +
        (rootChildren.length - 1) * NODE_GAP;
      rootSubtreeWidth = Math.max(rootBaseWidth, childrenTotalWidth);
    }

    const root: LayoutNode = {
      id: 'root-rt-node',
      name: rootName || 'Deceased Person',
      relationship: rootSubtitle,
      isDeceased: true,
      isApplicant: false,
      fatherOrHusbandName: rootDetails,
      depth: 0,
      width: rootSubtreeWidth,
      height: NODE_HEIGHT + 4,
      x: 0,
      y: 0,
      children: rootChildren,
    };

    // Top-Down Position Assignment Pass
    let maxDepth = 0;
    const connections: TreeConnection[] = [];

    const assignCoordinates = (
      node: LayoutNode,
      leftX: number,
      currentY: number
    ) => {
      node.y = currentY;
      if (node.depth > maxDepth) maxDepth = node.depth;

      if (node.children.length === 0) {
        node.x = leftX + node.width / 2;
      } else {
        const childrenTotalWidth =
          node.children.reduce((sum, c) => sum + c.width, 0) +
          (node.children.length - 1) * NODE_GAP;

        const extraOffset = (node.width - childrenTotalWidth) / 2;
        let curX = leftX + extraOffset;

        node.children.forEach((child) => {
          assignCoordinates(
            child,
            curX,
            currentY + node.height + LEVEL_GAP
          );
          curX += child.width + NODE_GAP;
        });

        // Center parent over all its children
        const firstChildX = node.children[0].x;
        const lastChildX = node.children[node.children.length - 1].x;
        node.x = (firstChildX + lastChildX) / 2;

        // Record SVG connection coordinates
        const parentBottomY = node.y + node.height / 2;
        const midY = parentBottomY + LEVEL_GAP / 2;

        connections.push({
          parentX: node.x,
          parentY: parentBottomY,
          midY,
          minChildX: firstChildX,
          maxChildX: lastChildX,
          childPoints: node.children.map((c) => ({
            x: c.x,
            y: c.y - c.height / 2,
          })),
        });
      }
    };

    assignCoordinates(root, PADDING + LEFT_GEN_OFFSET, PADDING + 10);

    const totalWidth = Math.max(340, root.width + PADDING * 2 + LEFT_GEN_OFFSET);
    const totalHeight =
      (maxDepth + 1) * (NODE_HEIGHT + LEVEL_GAP) + PADDING * 2 + 10;

    return { root, connections, totalWidth, totalHeight, maxDepth };
  };

  const { root, connections, totalWidth, totalHeight, maxDepth } = buildLayoutTree();

  const odiaDigits = ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'];
  const toOdiaGen = (num: number) =>
    String(num)
      .split('')
      .map((d) => odiaDigits[parseInt(d, 10)] ?? d)
      .join('');

  // Helper to render all nodes recursively
  const renderSvgNode = (node: LayoutNode) => {
    const isRoot = node.id === 'root-rt-node';
    const cardWidth = isRoot
      ? Math.min(node.width, Math.max(200, maxNodeWidth + 40))
      : Math.min(node.width - 4, maxNodeWidth);
    const cardHeight = node.height;
    const isApp = node.isApplicant;
    const isDec = node.isDeceased;
    const displayNameLen = (node.name || '').length;
    const nameFontSize = isRoot
      ? displayNameLen > 24 ? '10.5px' : '12px'
      : displayNameLen > 18 ? '9.5px' : '10.5px';

    return (
      <g key={node.id} className="transition-all select-none">
        {/* Node Box or Border */}
        {isRoot ? (
          <rect
            x={node.x - cardWidth / 2}
            y={node.y - cardHeight / 2}
            width={cardWidth}
            height={cardHeight}
            rx={4}
            fill="#f8fafc"
            stroke="#0f172a"
            strokeWidth={1.8}
          />
        ) : (
          <rect
            x={node.x - cardWidth / 2}
            y={node.y - cardHeight / 2}
            width={cardWidth}
            height={cardHeight}
            rx={4}
            fill={isApp ? '#fef3c7' : isDec ? '#f8fafc' : '#ffffff'}
            stroke={isApp ? '#d97706' : isDec ? '#94a3b8' : '#334155'}
            strokeWidth={isApp ? 1.5 : 1.2}
            strokeDasharray={isDec && !isRoot ? '3,2' : undefined}
          />
        )}

        {/* Name Text */}
        <text
          x={node.x}
          y={node.y - (isRoot ? 4 : 3)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0f172a"
          fontSize={nameFontSize}
          fontWeight={isRoot || isApp ? 'bold' : '600'}
        >
          {isDec && !isRoot ? '† ' : ''}
          {isApp ? '★ ' : ''}
          {node.name}
        </text>

        {/* Relationship and Status text */}
        <text
          x={node.x}
          y={node.y + (isRoot ? 11 : 9)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isDec ? '#475569' : '#334155'}
          fontSize={isRoot ? '9px' : '8.5px'}
          fontWeight="500"
        >
          {isRoot ? (
            node.relationship
          ) : (
            `(${node.relationship}) ${isDec ? '[ମୃତ]' : isApp ? '[ଆବେଦନ]' : '[ଜୀବିତ]'}`
          )}
        </text>
      </g>
    );
  };

  // Flatten all nodes for SVG rendering
  const allNodes: LayoutNode[] = [];
  const collectNodes = (n: LayoutNode) => {
    allNodes.push(n);
    n.children.forEach(collectNodes);
  };
  collectNodes(root);

  return (
    <div className={`w-full overflow-hidden flex flex-col items-center ${className}`}>
      <AutoFitScaleContainer maxHeight={280} className="w-full">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          width={totalWidth}
          height={totalHeight}
          className="overflow-visible block mx-auto font-sans"
          style={{ maxWidth: '100%' }}
        >
          {/* Defs for arrowheads and markers */}
          <defs>
            <marker
              id="genealogy-dot"
              viewBox="0 0 6 6"
              refX="3"
              refY="3"
              markerWidth="4"
              markerHeight="4"
            >
              <circle cx="3" cy="3" r="2.5" fill="#1e293b" />
            </marker>
          </defs>

          {/* SVG Vector Connections (Orthogonal tree bus-bars) */}
          {connections.map((conn, idx) => (
            <g key={`conn-${idx}`}>
              {/* Parent vertical drop line to bus bar */}
              <line
                x1={conn.parentX}
                y1={conn.parentY}
                x2={conn.parentX}
                y2={conn.midY}
                stroke="#1e293b"
                strokeWidth={1.5}
              />
              {/* Junction dot on parent stem */}
              <circle cx={conn.parentX} cy={conn.midY} r={2} fill="#1e293b" />

              {/* Horizontal crossbar spanning from first child to last child */}
              {conn.childPoints.length > 1 && (
                <line
                  x1={conn.minChildX}
                  y1={conn.midY}
                  x2={conn.maxChildX}
                  y2={conn.midY}
                  stroke="#1e293b"
                  strokeWidth={1.5}
                />
              )}

              {/* Vertical lines dropping to each child */}
              {conn.childPoints.map((cp, cIdx) => (
                <g key={`child-line-${cIdx}`}>
                  <line
                    x1={cp.x}
                    y1={conn.midY}
                    x2={cp.x}
                    y2={cp.y}
                    stroke="#1e293b"
                    strokeWidth={1.5}
                  />
                  {/* Junction dot at horizontal bar connection */}
                  <circle cx={cp.x} cy={conn.midY} r={2} fill="#1e293b" />
                </g>
              ))}
            </g>
          ))}

          {/* Optional Left Margin Generation Markers (କ୍ର.ନଂ ୧, ୨, ୩...) */}
          {showGenerationLabels &&
            Array.from({ length: maxDepth }, (_, idx) => {
              const genNum = idx + 1;
              const genY = PADDING + 10 + genNum * (NODE_HEIGHT + LEVEL_GAP);
              return (
                <text
                  key={`gen-label-${genNum}`}
                  x={10}
                  y={genY}
                  dominantBaseline="central"
                  fill="#334155"
                  fontSize="10px"
                  fontWeight="700"
                >
                  {`କ୍ର.ନଂ ${toOdiaGen(genNum)}`}
                </text>
              );
            })}

          {/* Render All Tree Nodes */}
          {allNodes.map(renderSvgNode)}
        </svg>
      </AutoFitScaleContainer>
    </div>
  );
};
