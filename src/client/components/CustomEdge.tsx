import { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';

const LAYER_STYLES = {
  command: {
    stroke: 'var(--flow-command)',
    strokeDasharray: 'none',
    markerEnd: 'url(#arrow-command)',
  },
  dataflow: {
    stroke: 'var(--flow-dataflow)',
    strokeDasharray: '6 4',
    markerEnd: 'url(#arrow-dataflow)',
  },
  sequence: {
    stroke: 'var(--flow-sequence)',
    strokeDasharray: '2 3',
    markerEnd: 'url(#arrow-sequence)',
  },
};

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
}: EdgeProps) {
  const layer = ((data as Record<string, unknown>)?.layer as keyof typeof LAYER_STYLES) || 'command';
  const style = LAYER_STYLES[layer];

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      {/* Glow path */}
      <path
        d={edgePath}
        fill="none"
        stroke={style.stroke}
        strokeWidth={6}
        strokeOpacity={0.08}
        strokeDasharray={style.strokeDasharray}
      />
      {/* Main path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={style.stroke}
        strokeWidth={layer === 'command' ? 2 : 1.5}
        strokeDasharray={style.strokeDasharray}
        strokeOpacity={0.7}
        markerEnd={style.markerEnd}
        style={{
          animation: layer === 'dataflow' ? 'signal-flow 1.5s linear infinite' : 'none',
        }}
      />
      {/* Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: style.stroke,
              background: 'var(--card)',
              padding: '1px 6px',
              borderRadius: 3,
              border: `1px solid ${style.stroke}`,
              borderColor: `color-mix(in srgb, ${style.stroke} 30%, transparent)`,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(CustomEdge);
