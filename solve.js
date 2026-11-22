// A fast drop-in for csv-reader 1.0.0, make.fun's own CSV reader: run(input) returns
// exactly the answer csv-reader's readCsv returns for {text, header}, the JSON value
// {columns, rows, errors}, and nothing else. Written for speed, not for show:
//
// - A line with no quote and no stray CR is split in native code (String.split),
//   one C++ pass for the whole record instead of a scan per field.
// - Other records are scanned field by field with indexOf jumps and slicing: the
//   line's end is found once per record, so an unquoted field needs one native scan
//   (the next comma); a cached "next CR" position says whether a field holds a stray
//   CR without scanning it. Quoted fields jump from quote to quote. No per-character
//   string building, no object allocated per field.
// - Errors are recorded in the order csv-reader meets them, with the same line
//   (the 1-based line the record starts on) and row (its index in rows, null for
//   the header). Quoted line breaks (LF, CRLF, lone CR inside quotes) each count
//   one line; a stray CR outside quotes is dropped and counts none.

const COMMA = 44; // ','
const LF = 10; // '\n'
const CR = 13; // '\r'
const QUOTE = 34; // '"'

// How a field ended: at a comma (the record goes on), at a line break or at the end.
const ENDED_COMMA = 0;
const ENDED_BREAK = 1;
const ENDED_END = 2;

// One line break inside quotes: CRLF, a lone CR, or an LF.
const BREAK_RE = /\r\n?|\n/g;

/** csv-reader 1.0.0's answer for one case's input, {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  let recordLine = 1; // the line the record being read starts on
  let recordRow = null; // its index in rows (null: the header)
  // The last field read: its value, how it ended, how many characters an unquoted
  // read added (for quote_junk: only what followed the closing quote counts).
  let fv = '';
  let fe = ENDED_END;
  let fa = 0;
  // The next line break at or after pos (len when there is none), and the next CR
  // at or after pos (Infinity when there is none). Both go stale as pos moves and
  // are refreshed lazily where they are read, so a scan never runs twice for them.
  // nextCR starts at -1 (not searched yet), which reads as stale.
  let lineEnd = len;
  let nextCR = -1;

  // A U+FEFF at the very start is dropped.
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // Files a record's fields: nothing for a line left with no characters, the header
  // for the first record when header is true, else a row padded or cut to the first
  // record's width (short_row with its field count, long_row with the cut fields).
  function finishRecord(fields, quoted) {
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  // Reads an unquoted field from pos, appending to `init` ('' normally, '"' when a
  // quote never closed, the quoted value for what follows a closing quote). Sets
  // fv, fe and fa. A CR not followed by LF is dropped (stray_cr); a CR just before
  // the line break is the CRLF, not part of the field.
  function readUnquoted(init) {
    if (lineEnd <= pos) {
      const nl = text.indexOf('\n', pos);
      lineEnd = nl === -1 ? len : nl;
    }
    if (nextCR < pos) {
      const r = text.indexOf('\r', pos);
      nextCR = r === -1 ? Infinity : r;
    }
    const c = text.indexOf(',', pos);
    let end;
    let kind; // 0: comma, 1: line break, 2: end of the text
    if (c !== -1 && c < lineEnd) {
      end = c;
      kind = 0;
    } else if (lineEnd < len) {
      end = lineEnd;
      kind = 1;
    } else {
      end = len;
      kind = 2;
    }
    let contentEnd = end;
    if (kind === 1 && end > pos && text.charCodeAt(end - 1) === CR) contentEnd = end - 1;
    let piece = contentEnd > pos ? text.slice(pos, contentEnd) : '';
    if (nextCR < contentEnd) {
      // A CR inside the piece is stray: none of them is followed by LF (the next
      // LF is past the field's end, and the CRLF's CR was cut above).
      const parts = piece.split('\r');
      for (let i = 0; i < parts.length - 1; i++) {
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      }
      piece = parts.join('');
    }
    fa = piece.length;
    fv = init === '' ? piece : init + piece;
    if (kind === 0) {
      pos = end + 1;
      fe = ENDED_COMMA;
    } else if (kind === 1) {
      pos = end + 1;
      line += 1;
      fe = ENDED_BREAK;
    } else {
      pos = len;
      fe = ENDED_END;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fv, fe and fa.
  function readQuoted() {
    const open = pos;
    let p = pos + 1;
    let doubled = false;
    let q;
    for (;;) {
      q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after it
        // is read again as unquoted. (The line is still the opening line: nothing
        // above counted a line break.)
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        pos = open + 1;
        readUnquoted('"');
        return;
      }
      if (text.charCodeAt(q + 1) === QUOTE) {
        doubled = true;
        p = q + 2;
        continue;
      }
      break;
    }
    // The closing quote is at q; the content is [open+1, q).
    let value = q > open + 1 ? text.slice(open + 1, q) : '';
    if (doubled) value = value.replaceAll('""', '"');
    // A line break in the content needs counting and normalising; the cached line
    // end and next CR say whether there is one without scanning the slice.
    if (lineEnd <= pos) {
      const nl = text.indexOf('\n', pos);
      lineEnd = nl === -1 ? len : nl;
    }
    if (nextCR < pos) {
      const r = text.indexOf('\r', pos);
      nextCR = r === -1 ? Infinity : r;
    }
    if (q >= lineEnd || nextCR < q) {
      // Each CRLF or lone CR inside quotes is one LF, and each line break counts.
      const breaks = value.match(BREAK_RE);
      line += breaks === null ? 0 : breaks.length;
      value = value.replace(BREAK_RE, '\n');
    }
    pos = q + 1;
    if (pos >= len) {
      fv = value;
      fe = ENDED_END;
      fa = 0;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === COMMA) {
      pos += 1;
      fv = value;
      fe = ENDED_COMMA;
      fa = 0;
      return;
    }
    if (c === LF) {
      pos += 1;
      line += 1;
      fv = value;
      fe = ENDED_BREAK;
      fa = 0;
      return;
    }
    if (c === CR && text.charCodeAt(pos + 1) === LF) {
      pos += 2;
      line += 1;
      fv = value;
      fe = ENDED_BREAK;
      fa = 0;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break (quote_junk, when the field ends with anything added).
    readUnquoted(value);
    if (fa > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // The record's line end (this record's first line break, or the end of the
    // text), found once here and reused by every unquoted field of the record.
    const nl = text.indexOf('\n', pos);
    lineEnd = nl === -1 ? len : nl;
    if (nextCR < pos) {
      const r = text.indexOf('\r', pos);
      nextCR = r === -1 ? Infinity : r;
    }

    // Fast path: a line with no quote and no stray CR splits in native code.
    const qi = text.indexOf('"', pos);
    if (qi === -1 || qi >= lineEnd) {
      if (nextCR >= lineEnd) {
        finishRecord(text.slice(pos, lineEnd).split(','), false);
        pos = nl === -1 ? len : nl + 1;
        if (nl !== -1) line += 1;
        continue;
      }
      if (nl !== -1 && nextCR === lineEnd - 1) {
        // The only CR closes the line: a CRLF ending.
        finishRecord(text.slice(pos, lineEnd - 1).split(','), false);
        pos = nl + 1;
        line += 1;
        continue;
      }
    }

    // Slow path: the record holds a quote or a stray CR; read it field by field.
    const fields = [];
    let quoted = false;
    do {
      if (text.charCodeAt(pos) === QUOTE) {
        quoted = true;
        readQuoted();
      } else {
        quoted = false;
        readUnquoted('');
      }
      fields.push(fv);
    } while (fe === ENDED_COMMA);
    finishRecord(fields, quoted);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
