export interface EditOperation {
  identifier: {
    major: number;
    minor: number;
  };
  range: {
    readonly startLineNumber: number;
    readonly startColumn: number;
    readonly endLineNumber: number;
    readonly endColumn: number;
  };
  text: string;
  forceMoveMarkers: boolean;
  isAutoWhitespaceEdit?: boolean;
}

/**
 * Parse the edit object on the value
 * @param value Current value
 * @param changes Edit object
 * @returns New value
 */
export function parseEdit(value: string, changes: EditOperation[]): string {
  let newValue: string[] = [''];
  if (value) {
    newValue = value.split('\n');
  }

  changes.forEach((change: EditOperation) => {
    const { startLineNumber, endLineNumber, startColumn, endColumn } = change.range;

    let newLines: string[] = newValue.slice(startLineNumber - 1, endLineNumber);

    const startLine: string = newLines[0].slice(0, startColumn - 1);
    const middleLine: string = change.text;
    const lastLine: string = newLines[newLines.length - 1].slice(endColumn - 1);

    const startLines: string[] = newValue.slice(0, startLineNumber - 1);
    const middleLines: string = startLine + middleLine + lastLine;
    const lastLines: string[] = newValue.slice(endLineNumber);

    newValue = [].concat(startLines, middleLines, lastLines);
  });

  return newValue.join('\n');
}

/**
 * Remove keys from an object
 * @param object Object to remove keys from
 * @param keys Keys to remove
 * @returns New object without keys
 */
export function removeKeys(object: object, keys: string[]) {
  const newObject = Object.assign({}, object);
  keys.forEach(key => {
    delete newObject[key];
  });
  return newObject;
}

/**
 * Generate a Random URL
 * @param count URL Length
 */
export function generateUrl(count: number): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz1234567890_-';
  const array = [];
  for (let i = 0; i < count; i++) {
    array.push(characters[Math.floor(Math.random() * characters.length)]);
  }
  return array.join('');
}

/**
 * Run promises in serial
 * @param funcs Array of functions that return a promise
 */
export function serialPromise(funcs: (() => Promise<any>)[]) {
  return funcs.reduce(
    (promise, func) => {
      return promise.then(result => func().then(Array.prototype.concat.bind(result)))
    },
    Promise.resolve([])
  );
}
