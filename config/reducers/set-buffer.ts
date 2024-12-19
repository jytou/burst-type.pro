import {captureEvent, createWord, type State} from '../state';
import en1000 from '../../wordlists/en1000.json';

type SetBufferAction = {
	type: 'SET_BUFFER';
	payload: string;
};

const setBuffer = (state: State, action: SetBufferAction): State => {
	if (state.showInstructions) {
		return state;
	}

	if (state.finished) {
		return state;
	}

	if ((state.streakMode && (state.word.streak >= state.targetStreak)) ||
	    ((!state.streakMode) && (state.word.progress >= 100))) {
		return state;
	}

	// eslint-disable-next-line unicorn/prefer-spread
	const match = action.payload.split('').every((character, index) => character === state.word.characters[index].character);
	const timeElapsed = (Date.now() - (state.word.startTime ?? 0)) / 60_000;
	const wpm = Math.round(action.payload.length / 5 / timeElapsed);
	const hitTargetWPM = wpm >= state.targetWPM;
	const capsDetected = action.payload !== action.payload.toLowerCase();

	if (!match) {
		return {
			...state,
			...captureEvent('failureTypo'),
			word: {
				...state.word,
				endTime: Date.now(),
				streak: 0,
				characters: state.word.characters.map((character, index) => ({
					...character,
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					correct: action.payload[index] === undefined
						? undefined
						: character.character === action.payload[index],
				})),
				wpm: 0,
				match: false,
				hitTargetWPM: false,
				prevprog: state.word.progress,
				progress: state.word.progress > 0 ? 0 : action.payload.length == 1 ? state.word.progress : Math.max(-100, state.word.progress - 10),
			},
			typoText: action.payload,
			buffer: '',
			capsDetected,
		};
	}

	if (state.word.endTime === undefined && action.payload.length >= state.word.characters.length) {
		const streak = hitTargetWPM ? state.word.streak + 1 : 0;
		const prevprog = state.word.progress;
		const addedProgress = Math.round(wpm >= state.targetWPM ? Math.sqrt(144.0 * wpm / state.targetWPM) - 2 : (wpm - state.targetWPM) / 2);
		const progress = state.word.progress < 0 ?
		                      Math.max(-100, state.word.progress + (addedProgress >= 0 ? addedProgress * 2 : 5)) :
							  Math.max(0, state.word.progress + addedProgress);

		if ((state.streakMode && (streak >= state.targetStreak)) ||
		    ((!state.streakMode) && (progress >= 100))
		   ) {
			// eslint-disable-next-line max-depth
			if (state.level + 1 === (state.customWordlist ?? en1000).length) {
				return {
					...state,
					...captureEvent('gameComplete'),
					finished: true,
					lastSave: Date.now(),
					capsDetected,
				};
			}

			return {
				...state,
				...captureEvent('streakComplete'),
				level: state.level + 1,
				highestLevel: Math.max(state.highestLevel ?? 0, state.level + 1),
				word: createWord(state.customWordlist ?? en1000, state.level + 1),
				buffer: '',
				lastSave: Date.now(),
				lastWPM: wpm,
				capsDetected,
			};
		}

		return {
			...state,
			...captureEvent(hitTargetWPM ? 'wordComplete' : 'failureSlow'),
			buffer: '',
			word: {
				...state.word,
				endTime: Date.now(),
				streak,
				characters: state.word.characters.map((character, index) => ({
					...character,
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					correct: action.payload[index] === undefined
						? undefined
						: character.character === action.payload[index],
				})),
				wpm,
				match,
				hitTargetWPM,
				prevprog,
				progress,
			},
			lastWPM: wpm,
			capsDetected,
		};
	}

	if (state.word.endTime === undefined) {
		return {
			...state,
			...captureEvent('type'),
			buffer: action.payload,
			word: {
				...state.word,
				startTime: state.word.startTime ?? Date.now(),
				characters: state.word.characters.map((character, index) => ({
					...character,
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					correct: action.payload[index] === undefined
						? undefined
						: character.character === action.payload[index],
				})),
			},
			capsDetected,
		};
	}

	const nextBuffer = action.payload;
	const repeatWord = createWord(state.customWordlist ?? en1000, state.level);

	if ((state.streakMode && (state.word.streak < state.targetStreak)) ||
	    ((!state.streakMode) && (state.word.progress < 100))) {
		return {
			...state,
			...captureEvent('type'),
			word: {
				...repeatWord,
				startTime: Date.now(),
				characters: repeatWord.characters.map((character, index) => ({
					...character,
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					correct: nextBuffer[index] === undefined
						? undefined
						: character.character === nextBuffer[index],
				})),
				streak: state.word.streak,
				prevprog: state.word.prevprog,
				progress: state.word.progress,
			},
			buffer: nextBuffer,
			capsDetected,
		};
	}

	return state;
};

export default setBuffer;

export type {
	SetBufferAction,
};
