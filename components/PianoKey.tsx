import React from 'react';

interface PianoKeyProps {
  index: number;
  isSharp: boolean;
  isActive: boolean;
  isHighlighted: boolean;
  noteName: string;
  onPress: (index: number) => void;
  onRelease: (index: number) => void;
}

const PianoKey: React.FC<PianoKeyProps> = ({
  index,
  isSharp,
  isActive,
  isHighlighted,
  noteName,
  onPress,
  onRelease,
}) => {
  // Common handlers for both touch and mouse to ensure responsiveness
  const handleStart = (e: React.SyntheticEvent) => {
    e.preventDefault(); // Prevent ghost clicks
    onPress(index);
  };

  const handleEnd = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onRelease(index);
  };

  if (isSharp) {
    // Sharp Key
    // Fixed widths: w-6 (1.5rem/24px) on mobile, w-8 (2rem/32px) on desktop
    // Negative margins: -mx-3 (-0.75rem) on mobile, -mx-4 (-1rem) on desktop
    // This centers the black key exactly over the border of two white keys (assuming white keys are w-10/w-14)
    return (
      <div
        className={`relative z-10 h-[60%] rounded-b-md shadow-md transition-all duration-75 select-none 
        flex-none w-8 -mx-4 md:w-10 md:-mx-5
        flex flex-col justify-end pb-2 items-center leading-none
        ${isActive 
          ? 'bg-green-600 scale-y-95 shadow-glow border border-green-500' // Dark Green when pressed
          : isHighlighted 
            ? 'bg-primary-500 border border-primary-400' 
            : 'bg-gray-800 border-x border-b border-gray-900'} 
        `}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
      >
        <div className={`text-[8px] md:text-[9px] text-center font-bold whitespace-pre-line pointer-events-none opacity-90
          ${isActive || isHighlighted ? 'text-white' : 'text-gray-400'}
        `}>
          {noteName}
        </div>
      </div>
    );
  }

  // White Key
  // Fixed widths: w-12 (3rem/48px) on mobile, w-14 (3.5rem/56px) on desktop
  return (
    <div
      className={`relative flex-none h-full rounded-b-lg border border-gray-300 transition-colors duration-75 select-none
      w-12 md:w-16
      ${isActive 
        ? 'bg-green-200' 
        : isHighlighted 
          ? 'bg-primary-100' 
          : 'bg-white'}
      active:bg-green-200
      `}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
    >
      <span className="absolute bottom-2 md:bottom-4 w-full text-center text-[10px] md:text-xs font-bold text-gray-500 pointer-events-none">
        {noteName}
      </span>
    </div>
  );
};

export default PianoKey;