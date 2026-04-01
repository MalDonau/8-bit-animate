import { useState, useCallback } from 'react';

export function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const pushState = useCallback((newState: T) => {
    setHistory((prevHistory) => {
      const updatedHistory = prevHistory.slice(0, currentIndex + 1);
      return [...updatedHistory, newState];
    });
    setCurrentIndex((prevIndex) => prevIndex + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prevIndex) => prevIndex - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    state: history[currentIndex],
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: (newState: T) => {
      setHistory([newState]);
      setCurrentIndex(0);
    }
  };
}
