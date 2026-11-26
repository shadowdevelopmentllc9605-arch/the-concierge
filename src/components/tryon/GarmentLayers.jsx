import React,{useId} from 'react';
import {FABRICS} from '@/lib/garmentRenderPlan';

export default function GarmentLayers({layers}){
  const prefix=useId().replace(/[^a-zA-Z0-9_-]/g,'');
  return layers.map((layer,i)=>{
    const material=FABRICS[layer.type],id=prefix+'-'+i;
    const shapes=[...layer.sleeves,...layer.panels];
    const fill='url(#'+id+'-light)';
    return <g key={i}>
      <defs>
        <linearGradient id={id+'-light'} x1="0%" y1="30%" x2="100%" y2="65%">
          <stop offset="0%" stopColor={material.dark}/><stop offset="24%" stopColor={material.base}/>
          <stop offset="48%" stopColor={material.light}/><stop offset="65%" stopColor={material.base}/><stop offset="100%" stopColor={material.dark}/>
        </linearGradient>
        <pattern id={id+'-fabric'} patternUnits="userSpaceOnUse" width="4" height="4">
          {material.texture==='twill'?<path d="M-1 1 L1 -1 M0 4 L4 0 M3 5 L5 3" stroke="#fff" strokeWidth=".55" opacity=".12"/>:<path d="M1 0 V4 M3 0 V4 M0 2 H4" stroke="#fff" strokeWidth=".4" opacity=".12"/>}
        </pattern>
        <clipPath id={id+'-clip'}>{shapes.map((p,j)=><path key={j} d={p}/>)}</clipPath>
      </defs>
      {shapes.map((p,j)=><path key={j} d={p} fill={fill} stroke={material.seam} strokeWidth="1" strokeLinejoin="round"/>)}
      <g clipPath={'url(#'+id+'-clip)'}>
        <rect width="100%" height="100%" fill={'url(#'+id+'-fabric)'}/>
        {layer.folds.map((p,j)=><g key={j}><path d={p} stroke={material.dark} strokeWidth="3.6" opacity=".20" fill="none" strokeLinecap="round"/><path d={p} stroke={material.light} strokeWidth=".8" opacity=".65" fill="none"/></g>)}
        {layer.seams.map((p,j)=><path key={j} d={p} stroke={material.seam} strokeWidth={j<2?1:1.3} opacity=".8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
        {layer.buttons.map((p,j)=><circle key={j} cx={p.x} cy={p.y} r="2" fill={material.dark} stroke={material.light} strokeWidth=".5"/>)}
      </g>
    </g>;
  });
}
