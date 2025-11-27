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
    // e.preventDefault(); // Removed to allow scrolling
    onPress(index);
  };

  const handleEnd = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onRelease(index);
  };
  
  const handleCancel = (e: React.SyntheticEvent) => {
    onRelease(index);
  }

  if (isSharp) {
    // Sharp Key
    // Increased font size and adjusted height for mobile readability
    return (
      <div
        className={`relative z-10 h-[55%] md:h-[60%] rounded-b-md shadow-md transition-all duration-75 select-none 
        flex-none w-8 -mx-4 md:w-10 md:-mx-5
        flex flex-col justify-end pb-3 items-center leading-tight
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
        onTouchCancel={handleCancel}
      >
        <div className={`text-[10px] md:text-xs text-center font-bold whitespace-pre-line pointer-events-none transition-opacity duration-100
          ${isActive || isHighlighted ? 'opacity-100 text-white' : 'opacity-0'}
        `}>
          {noteName}
        </div>
      </div>
    );
  }

  // White Key
  // Moved label up (bottom-6) to avoid OS gesture bars
  // Increased font size
  return (
    <div
      className={`relative flex-none h-full rounded-b-lg border border-gray-300 transition-colors duration-75 select-none
      w-12 md:w-16
      ${isActive 
        ? 'bg-green-200' 
        : isHighlighted 
          ? 'bg-blue-200' 
          : 'bg-white'}
      active:bg-green-200
      `}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleCancel}
    >
      <span className={`absolute bottom-6 md:bottom-4 w-full text-center text-xs md:text-sm font-bold pointer-events-none bg-inherit pb-1 md:pb-0 transition-opacity duration-100
        ${isActive || isHighlighted ? 'opacity-100 text-gray-800' : 'opacity-0'}
      `}>
        {noteName}
      </span>
    </div>
  );
};

export default PianoKey;