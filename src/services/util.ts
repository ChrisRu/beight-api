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
    value.split('\n');
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
 * Get multiple characters
 * @param amount Character amount
 * @param character Character to multiply
 */
export function getCharacters(amount: number, character: string = ' ') {
  return Array(amount).join(character);
}
