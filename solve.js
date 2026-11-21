// solve.js — a fast drop-in replacement for csv-reader 1.0.0.
//
// run(input) returns exactly csv-reader 1.0.0's answer for {text, header}: {columns, rows, errors}, under the same
// broken-row policy (a leading U+FEFF is dropped; a record ends at LF or CRLF and an empty line is no record; a lone
// CR outside quotes is dropped as stray_cr; a quoted field runs to the next undoubled quote with "" read as one
// quote and CRLF or a lone CR inside read as LF; characters after the closing quote are appended as they stand,
// quote_junk; a quote that never closes is a literal character and the rest is reread unquoted,
// unterminated_quote; fields stay strings; rows are padded or cut to the first record's width, short_row and
// long_row).
//
// The reference builds every field one character at a time and allocates a result object per field. This reader
// instead scans with charCodeAt and cuts each field out of the text with one slice, so the common field costs one
// scan and one slice; the pieces array below is only allocated for the rare field a dropped CR splits. Nothing is
// kept from one call to the next.

// How the field just read ended: the record goes on, the record ends, or the text ends.
const COMMA = 0;
const BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0; // a U+FEFF at the very start is dropped
  let line = 1;
  let recordLine = 1; // the line the record being read starts on
  let recordRow = null; // its index in rows (null: the header)
  let ended = END; // how the field most recently read ended

  // The value of a field whose raw run [seg, upto) is still in the text: `initial` was read before it (a literal
  // quote, or a quoted field's value ahead of its junk), and `parts`, when a dropped CR split the field, holds the
  // pieces read so far, `initial` first.
  function collect(initial, parts, seg, upto) {
    if (parts === null) {
      return initial === '' ? text.slice(seg, upto) : initial + text.slice(seg, upto);
    }
    parts.push(text.slice(seg, upto));
    return parts.join('');
  }

  // Reads an unquoted field (or the tail of one) onto `initial`, up to the next comma or line break. The scan
  // itself has no side effects, so the common field — no dropped CR in it — is cut out with a single slice the
  // moment its terminator is met; only a field a stray CR splits is reread by unquotedSplit. Sets `ended` and
  // returns the field's value.
  function unquoted(initial) {
    const start = pos;
    let i = pos;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44) {
        // ','
        pos = i + 1;
        ended = COMMA;
        return initial === '' ? text.slice(start, i) : initial + text.slice(start, i);
      }
      if (c === 10) {
        // LF
        pos = i + 1;
        line += 1;
        ended = BREAK;
        return initial === '' ? text.slice(start, i) : initial + text.slice(start, i);
      }
      if (c === 13) {
        // CR: CRLF ends the record; a lone CR is dropped (stray_cr) and splits the field.
        if (text.charCodeAt(i + 1) === 10) {
          pos = i + 2;
          line += 1;
          ended = BREAK;
          return initial === '' ? text.slice(start, i) : initial + text.slice(start, i);
        }
        return unquotedSplit(initial);
      }
      i += 1;
    }
    pos = n;
    ended = END;
    return initial === '' ? text.slice(start, n) : initial + text.slice(start, n);
  }

  // The unquoted read for the rare field a stray CR splits: each lone CR is dropped (stray_cr) and the pieces
  // around it are joined. Reads from pos, which is still the field's start.
  function unquotedSplit(initial) {
    const parts = [initial];
    let seg = pos;
    let i = pos;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44) {
        pos = i + 1;
        ended = COMMA;
        parts.push(text.slice(seg, i));
        return parts.join('');
      }
      if (c === 10) {
        pos = i + 1;
        line += 1;
        ended = BREAK;
        parts.push(text.slice(seg, i));
        return parts.join('');
      }
      if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          pos = i + 2;
          line += 1;
          ended = BREAK;
          parts.push(text.slice(seg, i));
          return parts.join('');
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        parts.push(text.slice(seg, i));
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
    pos = n;
    ended = END;
    parts.push(text.slice(seg, n));
    return parts.join('');
  }

  // Reads a quoted field whose opening quote is at pos. Sets `ended` and returns the field's value.
  function quoted() {
    const open = pos;
    const openLine = line;
    let parts = null;
    let seg = pos + 1; // the start of the raw run not yet copied out
    for (;;) {
      const q = text.indexOf('"', seg);
      if (q === -1) break; // no quote left: the field never closes
      // One pass over the run [seg, q): count its LFs, and stop at its first CR, which is met before the quote and
      // is read as one LF (a CRLF as one LF too).
      let cr = -1;
      let lfs = 0;
      for (let i = seg; i < q; i += 1) {
        const c = text.charCodeAt(i);
        if (c === 13) {
          cr = i;
          break;
        }
        if (c === 10) lfs += 1;
      }
      if (cr !== -1) {
        if (parts === null) parts = ['', text.slice(seg, cr), '\n'];
        else parts.push(text.slice(seg, cr), '\n');
        line += lfs + 1;
        seg = text.charCodeAt(cr + 1) === 10 ? cr + 2 : cr + 1;
        continue;
      }
      line += lfs;
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote is one literal quote; the field goes on.
        if (parts === null) parts = ['', text.slice(seg, q), '"'];
        else parts.push(text.slice(seg, q), '"');
        seg = q + 2;
        continue;
      }
      // The closing quote.
      const value = collect('', parts, seg, q);
      pos = q + 1;
      if (pos >= n) {
        ended = END;
        return value;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        ended = COMMA;
        return value;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        ended = BREAK;
        return value;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        ended = BREAK;
        return value;
      }
      // What follows the closing quote is appended as it stands, up to the next comma or line break.
      const withJunk = unquoted(value);
      if (withJunk.length > value.length) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
      return withJunk;
    }
    // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
    pos = open + 1;
    line = openLine;
    errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
    return unquoted('"');
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    do {
      lastQuoted = text.charCodeAt(pos) === 34;
      fields.push(lastQuoted ? quoted() : unquoted(''));
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
