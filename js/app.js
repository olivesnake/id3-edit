/*

 */



/* ---------CONSTANTS ------- */
const DEFAULT_ENCODING = "iso-8859-1";
const NULLBYTE = 0x00;
const TEXT_INFO_FRAMES = new Set(["TALB", "TBPM", "TCOM",
  "TCON", "TCOP", "TDAT", "TDLY", "TENC", "TEXT", "TFLT", "TIME", "TIT1",
  "TIT2", "TIT3", "TKEY", "TLAN", "TMED", "TYER", "TOAL", "TOFN", "TOLY",
  "TOPE", "TORY", "TOWN", "TPE1", "TPE2", "TPE3", "TPE4", "TPOS","TPUB",
  "TRCK", "TSRC", "TSIZ" ]);
const SUPPORTED_FRAMES = new Set([...TEXT_INFO_FRAMES.values(), "COMM"])
const NUMERIC_STRINGS = new Set(["TPOS", "TRCK", "TSIZ", "TYER", "TDAP", "TDLY", "TIME", "TLEN"]);
const METADATA_MAP = {
  'TIT2': 'title', 'TALB': 'album', 'TPUB': 'publisher', 'TCON': 'genre',
  'TYER': 'release_year', 'TRCK': 'track_number', 'TPOS': 'disc_number', 'TPE1': 'artists',
  'TPE2': 'accompaniment', 'TPE3': 'conductor', 'TPE4': 'remixer', 'TCOM': 'composer', 'APIC': 'picture', 'COMM': 'comments'
}
const ENCODING_LOOKUP = {
  0: "iso-8859-1",
  1: "utf-16le",
  2: "utf-16be",
  3: "utf-8"
}
const FORM_INPUT_FIELDS = [
  {name: "title", type: 'text'},
  {name: "album", type: 'text'},
  {name: "artists", type: 'text'},
  {name: "accompaniment", type: 'text'},
  {name: "composer", type: "text"},
  {name: "publisher", type: "text"},
  {name: "genre", type: "text"},
  {name: "release_year", type: "number"},
  {name: "track_number", type: "number"},
  {name: "disc_number", type: "number"}
]
const DEFAULT_ID3V2_HEADER_LEN = 10;
const FRAME_SIZE_INFO_LEN = 4;
const FRAME_ID_SIZE = 4;
/* ---------CONSTANTS ------- */




function toHex(array) {
  return array.reduce((acc, cur) => acc + cur.toString(16).padStart(2, '0'), '')
}


function decodeSynchSafe(bytes, msbIndex) {
  // https://phoxis.org/2010/05/08/synch-safe/
  return ((bytes[msbIndex] & 0x7f) << 21) |
  ((bytes[msbIndex + 1] & 0x7f) << 14) | ((bytes[msbIndex + 2]  & 0x7f) << 7) | (bytes[msbIndex + 3] & 0x7f);
}

function encodeSynchSafe(x) {
  // assumes 32-bit synchsafe creation
  const out = new Uint8Array(4);

  return out;
}

function encodeStringToLatin1(s){
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    out[i] = (c <= 0xff) ? c : 0x3f;
  }
  return out;
}

function getFrameHeader(frameId, length){
  if (frameId.length !== 4){
    throw Error
  }
  // const encoder = new TextEncoder();
  // const decoder = new TextDecoder(DEFAULT_ENCODING);


  const header = new Uint8Array([
    ...encodeStringToLatin1(frameId), ...encodeSynchSafe(length) , 0x00, 0x00
  ]);

  return header;
}

function writeTextFrame(text, frameId){
  const header = getFrameHeader(frameId, text.length);
  console.log(header);

  const frame = new Uint8Array([]);
  // text.forEach((c) => {c.charC})
  return frame;
}

writeTextFrame("hello", "TIT1");

function findByte(bytes, pos, target){
  target = target & 0xff; // ensure within 0-255 range
  const len = bytes.length;
  let j = pos;
  while (j < len && bytes[j] !== target) j++;
  return (j < len) ? j : -1;
}

async function hashFile(file, algorithm = "SHA-256") {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest(algorithm, buffer);
  return toHex([... new Uint8Array(digest)])
  // return [... new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}


async function convertBytesToBase64(u8, type) {
  const blob = new Blob([u8], {type: type});
  return await readFileAsDataURL(blob);
}
function createDataURLFromBytes(u8, type) {
  const blob = new Blob([u8], {type: type});
  return URL.createObjectURL(blob);
}

function stripTrailingNulls(s) {
  let i = s.length;
  while (i > 0 && s.charCodeAt(i - 1) === 0) i--;
  return i === s.length ? s : s.slice(0, i);
}


function handleID3v1(buffer) {
  return {}
}
function handleID3v2(buffer) {
  /* sources:
  https://id3.org/id3v2.3.0
  https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
   */
  let decoder;
  const view = new Uint8Array(buffer);
  const isExtendedHeader = Boolean(view.at(6));
  if (isExtendedHeader) {
    // TODO: implement extended header handling
  }

  let metadata = {
    title: '',
    album: '',
    artists: '',
    accompaniment: '',
    composer: '',
    release_year: new Date().getFullYear(),
    track_number: 1,
    disc_number: 1,
    publisher: '',
    genre: '',
    picture: null,
    comments: ''
  };
  let pos = DEFAULT_ID3V2_HEADER_LEN; // track byte position
  let end;
  while (pos < view.byteLength) {
    /* parse frame header information */
    decoder = new TextDecoder(DEFAULT_ENCODING); // default encoder
    const frameId = decoder.decode(view.subarray(pos, pos + FRAME_ID_SIZE));
    pos += FRAME_ID_SIZE;
    /* extract the frame itself based on defined size */
    const frameSize = decodeSynchSafe(view, pos);
    pos += FRAME_SIZE_INFO_LEN + 2; // skip over frame info and flags bytes


    if (!SUPPORTED_FRAMES.has(frameId) && frameId !== "APIC"){ // skip unimplemented frames
      pos = pos + frameSize;
      continue;
    }
    // TODO: implement comments handling
    /* extract frame content */
    let offset = 0;
    let content;
    if (frameId === "COMM"){
      decoder = new TextDecoder(ENCODING_LOOKUP[view[pos]]); // text encoding description byte
      pos++;
      offset++;
      // unicode termination string has two null bytes, latin-1 has 1
      const  descEndIdx = findByte(view, pos, NULLBYTE) + ((decoder.encoding === "utf-16le") ? 2 : 1);
      offset += descEndIdx - pos;
      pos = descEndIdx;
      if (decoder.encoding === "utf-16le") {
        // skip unicode BOM
        pos += 2;
        offset += 2;
      }
      end = pos + frameSize - offset;
      metadata.comments = stripTrailingNulls(decoder.decode(view.subarray(pos, end)));
      pos = end;
    }
    if (TEXT_INFO_FRAMES.has(frameId)) {
      decoder = new TextDecoder(ENCODING_LOOKUP[view[pos]]); // text encoding description byte
      pos++;
      offset++;
      if (NUMERIC_STRINGS.has(frameId)){
        content = decoder.decode(view.subarray(pos, pos + frameSize - offset));
        if (frameId === "TPOS" || frameId === "TRCK")
          content = content.split('/').at(0); // format for these is e.g. 1/27 for track 1 of 27 total

      } else {
        if (decoder.encoding === "utf-16") {
          // skip unicode BOM
          pos += 2;
          offset += 2;
        }
        content = decoder.decode(view.subarray(pos, pos + frameSize - offset));
      }
      pos += frameSize - offset;
      if (!frameId in METADATA_MAP) continue;
      else {
        metadata[METADATA_MAP[frameId]] = stripTrailingNulls(content);
      }

    } else if (frameId === "APIC") { // handle attached picture if exists
      /* parse additional attached picture header */
      decoder = new TextDecoder( ENCODING_LOOKUP[view.at(pos++)]);
      // get mimetype value
      let mimeTypeEndIdx = findByte(view, pos, NULLBYTE);
      const mimeType = decoder.decode(view.subarray(pos, mimeTypeEndIdx));
      // seek and skip description value and picture type
      pos = findByte(view, mimeTypeEndIdx + 1, NULLBYTE) + 1;
      /* parse image */
      if (mimeType !== "image/jpeg") { // png
        // TODO: implement png handling
      } else {
        // find last occurance of JPEG End Of Image (EOI) marker
        let endOfImageIdx = view.byteLength - 1;
        for (; endOfImageIdx > pos; endOfImageIdx--) {
          if (view[endOfImageIdx - 1] === 0xff && view[endOfImageIdx] === 0xd9){
            break;
          }
        }

        metadata.picture = view.slice(pos, endOfImageIdx);
        pos = endOfImageIdx + 1;
      }
    }
  }

  return metadata;
}

async function readFileAsBuffer(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new DOMException("Read aborted"));
    reader.readAsArrayBuffer(file);
  })
}
async function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new DOMException("Read aborted"));
    reader.readAsDataURL(file);
  })
}
async function parseMp3Metadata(file) {
  const buffer = await readFileAsBuffer(file).catch(() => {})
  const decoder = new TextDecoder(DEFAULT_ENCODING);
  const tag = new Uint8Array(buffer.slice(0, 128));
  const identifier = decoder.decode(buffer.slice(0, 3));
  if (identifier !== "ID3") throw new Error("invalid identifier");
  // check for ID3v2
  return (tag[3] !== 3) ? handleID3v1(buffer) : handleID3v2(buffer)

}



document.addEventListener("DOMContentLoaded", function () {

  let objectUrls = []; // track all objectUrls in the app
  // const audioSource = document.getElementById("audio-source");
  const container = document.getElementById("container");
  const fileUploadInput = document.getElementById("file-upload-input");
  async function CreateEditForm(file) {
    const metadata = await parseMp3Metadata(file);
    const itemId = crypto.randomUUID();
    const form = document.createElement("form");
    form.className = "metadata-form";
    form.style.width = "100%";
    const fileTitle = document.createElement("div");
    fileTitle.className = "input-group";
    fileTitle.textContent = file.name;
    fileTitle.style.fontSize = "18px";
    fileTitle.style.fontWeight = "600";
    form.appendChild(fileTitle);
    FORM_INPUT_FIELDS.forEach((data) => {
      const template = document.createElement("template");
      template.innerHTML =
        `<div class="input-group">
      <label for="${data.name}-input">${data.name.split('_').join(' ')}</label>
      <input
      type="${data.type}"
      class="input"
      id="${data.name}-input"
        ${(data.type === "number")? 'min=0': ''}
        value='${metadata[data.name]}'>
    </div>`;
      form.appendChild(template.content.firstElementChild);
    })
    // add picture field
    const apicDiv = document.createElement("div");
    apicDiv.className = "input-group";
    const label = document.createElement("label");
    label.textContent = "Picture";
    apicDiv.append(label);

    const uploadDiv = document.createElement("div");
    uploadDiv.id = 'picture-upload-preview';
    if (metadata.picture){
      const obj = createDataURLFromBytes(metadata.picture);
      objectUrls.push(obj);
      uploadDiv.style.background = `#fff url(${obj}) center / contain no-repeat`
      // uploadDiv.style.backgroundImage = `url(${obj})`;
      // uploadDiv.style.objectFit = 'scale-down';
      // uploadDiv.style.objectPosition = 'center';

    }
    const apicSpan = document.createElement("span");
    apicSpan.textContent = "Select a Picture";
    uploadDiv.appendChild(apicSpan);
    const apicInput = document.createElement("input");
    apicInput.type = "file";
    apicInput.hidden = true;
    apicInput.accept = "image/jpeg";
    uploadDiv.addEventListener("click", () => apicInput.click())
    apicInput.addEventListener("change", () => {
      console.log('here')})
    uploadDiv.appendChild(apicInput);
    apicDiv.appendChild(uploadDiv)
    form.appendChild(apicDiv);


    // add comments field
    const template = document.createElement("template");
    template.innerHTML = `<div class="input-group">
    <label for="comments">Comments</label>
    <textarea name="comments" id="comments" style="resize: none; height:5em; flex: 2">${metadata.comments}
</textarea>
  </div>`
    form.append(template.content.firstElementChild)

    const submitButton = document.createElement("input");
    submitButton.type = "submit";
    submitButton.value = "Save";
    submitButton.id = "save-button";
    submitButton.style.width = "100%";
    form.appendChild(submitButton);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
    })
    return form;
  }
  document.getElementById("file-upload-div").addEventListener("click", () => fileUploadInput.click());
  fileUploadInput.addEventListener("change", async () => {
    const files = fileUploadInput.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const form = await CreateEditForm(file);
      form.id = `metadata-upload-form-${i}`;
      container.appendChild(form);
    }
  })


  window.addEventListener("beforeunload", (e) => {
    // clean up
    e.preventDefault();
    objectUrls.forEach((obj) => {
      URL.revokeObjectURL(obj);
    })
    e.returnValue = '';
  })


})
