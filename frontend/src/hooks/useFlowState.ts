import { useReducer } from 'react';
import { PredictionResponse } from '../api/types';

export type FlowStep = 'landing' | 'data' | 'analysing' | 'results';

export interface UploadedFileInfo {
  name: string;
  totalRows: number;
  size: number;
}

export interface FlowState {
  step: FlowStep;
  readings: number[][];
  prediction: PredictionResponse | null;
  analysisError: string | null;
  uploadedFileInfo: UploadedFileInfo | null;
  activeInputTab: 'upload' | 'manual';
  isHelpDrawerOpen: boolean;
}

export type FlowAction =
  | { type: 'START_FLOW' }
  | { type: 'GO_TO_DATA' }
  | { type: 'SET_INPUT_TAB'; tab: 'upload' | 'manual' }
  | { type: 'SET_READINGS'; readings: number[][]; fileInfo?: UploadedFileInfo | null }
  | { type: 'CLEAR_DATA'; windowSize: number; nFeatures: number }
  | { type: 'TOGGLE_HELP_DRAWER'; open?: boolean }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_SUCCESS'; prediction: PredictionResponse }
  | { type: 'ANALYSIS_ERROR'; error: string }
  | { type: 'RESET_FLOW' };

function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'START_FLOW':
      return {
        ...state,
        step: 'data',
      };
    case 'GO_TO_DATA':
      return {
        ...state,
        step: 'data',
        analysisError: null,
      };
    case 'SET_INPUT_TAB':
      return {
        ...state,
        activeInputTab: action.tab,
      };
    case 'SET_READINGS':
      return {
        ...state,
        readings: action.readings,
        uploadedFileInfo: action.fileInfo !== undefined ? action.fileInfo : state.uploadedFileInfo,
      };
    case 'CLEAR_DATA':
      return {
        ...state,
        readings: Array.from({ length: action.windowSize }, () => new Array(action.nFeatures).fill(0)),
        uploadedFileInfo: null,
      };
    case 'TOGGLE_HELP_DRAWER':
      return {
        ...state,
        isHelpDrawerOpen: action.open !== undefined ? action.open : !state.isHelpDrawerOpen,
      };
    case 'START_ANALYSIS':
      return {
        ...state,
        step: 'analysing',
        analysisError: null,
      };
    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        step: 'results',
        prediction: action.prediction,
        analysisError: null,
      };
    case 'ANALYSIS_ERROR':
      return {
        ...state,
        analysisError: action.error,
      };
    case 'RESET_FLOW':
      return {
        ...state,
        step: 'landing',
        prediction: null,
        analysisError: null,
      };
    default:
      return state;
  }
}

export function useFlowState() {
  const [state, dispatch] = useReducer(flowReducer, {
    step: 'landing',
    readings: [],
    prediction: null,
    analysisError: null,
    uploadedFileInfo: null,
    activeInputTab: 'upload',
    isHelpDrawerOpen: false,
  });

  return { state, dispatch };
}

