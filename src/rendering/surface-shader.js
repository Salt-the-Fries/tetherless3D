const SURFACE_SHADER_KEY='tetherless3d-exterior-toon-screentone-v2';

/**
 * Shared visible-surface toon and screentone treatment.
 * Uses view-space normals and screen-space dots; no extra render target
 * or geometry conversion is required for this lightweight first pass.
 */
export function applyToonSurfaceShader(material,{strength=.72,screentone=.32}={}){
  material.userData.surfaceShader='exterior-toon-screentone';
  material.onBeforeCompile=(shader)=>{
    shader.uniforms.uSurfaceToonStrength={value:strength};
    shader.uniforms.uSurfaceScreentone={value:screentone};
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uSurfaceToonStrength;
      uniform float uSurfaceScreentone;`
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      // MeshStandardMaterial's normal is already in view space here.
      // Avoid a viewMatrix dependency in the fragment shader.
      float surfaceNdotL=max(dot(normalize(normal),normalize(vec3(-0.38,0.72,0.58))),0.0);
      float surfaceBands=surfaceNdotL<0.30?0.46:(surfaceNdotL<0.68?0.76:1.0);
      float toonMix=clamp(uSurfaceToonStrength,0.0,1.0);
      outgoingLight*=mix(1.0,surfaceBands,toonMix);

      // Classic comic screentone: small halftone dots appear in shaded areas.
      vec2 toneCell=fract(gl_FragCoord.xy/5.0)-0.5;
      float toneDot=1.0-smoothstep(0.16,0.27,length(toneCell));
      float shadowWeight=1.0-surfaceBands;
      float toneAmount=toneDot*shadowWeight*clamp(uSurfaceScreentone,0.0,1.0);
      outgoingLight*=1.0-toneAmount*0.34;`
    );
  };
  material.customProgramCacheKey=()=>SURFACE_SHADER_KEY;
  material.needsUpdate=true;
  return material;
}
