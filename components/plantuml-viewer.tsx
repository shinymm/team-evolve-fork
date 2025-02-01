'use client';

import { encode } from 'plantuml-encoder';

interface PlantUmlViewerProps {
  content: string;
}

export default function PlantUmlViewer({ content }: PlantUmlViewerProps) {
  const encodedContent = encode(content.trim());
  const imageUrl = `https://www.plantuml.com/plantuml/svg/${encodedContent}`;

  return (
    <div className="w-full overflow-auto">
      <img src={imageUrl} alt="架构图" className="mx-auto" />
    </div>
  );
} 