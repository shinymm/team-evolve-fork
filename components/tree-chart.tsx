'use client';

interface TreeProps {
  label: React.ReactNode;
  children?: React.ReactNode;
  lineWidth?: string;
  lineColor?: string;
  lineBorderRadius?: string;
}

export function Tree({ label, children, lineWidth = '2px', lineColor = '#cbd5e1', lineBorderRadius = '10px' }: TreeProps) {
  return (
    <div className="relative flex flex-col items-center">
      <div>{label}</div>
      {children && (
        <>
          <div 
            className="w-0.5 bg-slate-200 my-4"
            style={{ 
              width: lineWidth,
              backgroundColor: lineColor,
              borderRadius: lineBorderRadius
            }} 
          />
          <div className="flex gap-16">
            {children}
          </div>
        </>
      )}
    </div>
  );
} 