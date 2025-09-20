
/*
Resources:
https://www.multiweb.cz/twoinches/mp3inside.htm
 */



/* ---------CONSTANTS ------- */
const DEFAULT_ENCODING = "iso-8859-1";
const FRAME_HEADER_LENGTH = 10;
const NULLBYTE = 0x00;
const UTF_TERMINATOR = new Uint8Array([NULLBYTE, NULLBYTE]);
const TEXT_INFO_FRAMES = new Set(["TALB", "TBPM", "TCOM",
  "TCON", "TCOP", "TDAT", "TDLY", "TENC", "TEXT", "TFLT", "TIME", "TIT1",
  "TIT2", "TIT3", "TKEY", "TLAN", "TMED", "TYER", "TOAL", "TOFN", "TOLY",
  "TOPE", "TORY", "TOWN", "TPE1", "TPE2", "TPE3", "TPE4", "TPOS","TPUB",
  "TRCK", "TSRC", "TSIZ" ]);
const SUPPORTED_FRAMES = new Set([...TEXT_INFO_FRAMES.values(), "COMM", "APIC"])
const METADATA_MAP = {
  'TIT2': 'title', 'TALB': 'album', 'TPUB': 'publisher', 'TCON': 'genre',
  'TYER': 'release_year', 'TRCK': 'track_number', 'TPOS': 'disc_number', 'TPE1': 'artists',
  'TPE2': 'accompaniment', 'TPE3': 'conductor', 'TPE4': 'remixer', 'TCOM': 'composer', 'APIC': 'picture', 'COMM': 'comments'
}

const METADATA_KEY_TO_FRAMEID = {
  'title': 'TIT2', 'album': 'TALB', 'publisher': 'TPUB', 'genre': 'TCON',
  'release_year': 'TYER', 'track_number': 'TRCK', 'disc_number': 'TPOS',
  'artists':'TPE1', 'accompaniment': 'TPE2', 'coductor': 'TPE3', 'remixer': 'TPE4',
  'composer': 'TCOM', 'comments': 'COMM', 'picture': 'APIC'
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
/* ---------CONSTANTS ------- */



function encodeSynchSafe(x) {
  // encodes a 32-bit integer into a byte array representing 28-bit synchsafe encoding
  if (x > 0x0FFFFFFF) {
    throw new Error(`${x} is too large to be encoded into synchsafe.`);
  }
  if (x < 0b1000) { // integer already valid
    return new Uint8Array([0, 0, 0, x]);
  }
  return new Uint8Array([0x7F & (x >> 21), 0x7F & (x >> 14), 0x7F & (x >> 7), 0x7F & x]);

}

function encodeStringToUTF16LE(s, withBOM = true){
  // convert a string into a utf-16 little-endian byte array
  // https://unicode.org/faq/utf_bom.html#utf16-3
  const bytes = new Uint8Array(s.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < s.length; i++){
    view.setUint16(i * 2, s.charCodeAt(i), true);
  }
  if (withBOM) {
    const bom = new Uint8Array(bytes.length + 2); // unicode BOM indicating little endian
    bom[0] = 0xFF
    bom[1] = 0xFE
    bom.set(bytes, 2);
    return bom;
  }
  return bytes;
}


function getBE32BitInt(bytes, byteOffset){
  return (bytes[byteOffset] << 24) | (bytes[byteOffset + 1] << 16) | (bytes[byteOffset + 2] << 8) | bytes[byteOffset + 3]
}
function writeBE32BitInt(num) {
  return new Uint8Array([(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff])
}

// function writeB

/*
parses ID3v2 frame header information
Frame ID       $xx xx xx xx (four characters)
Size           $xx xx xx xx
Flags          $xx xx
 */
function parseFrameHeader(bytes) {
  const decoder = new TextDecoder(DEFAULT_ENCODING);
  return {
    id: decoder.decode(bytes.subarray(0, 4)),
    size: getBE32BitInt(bytes, 4) + FRAME_HEADER_LENGTH,
    flags: (bytes[8] << 8) | bytes[9]
  }
}

function createFrameHeader(id, size, flags=null){
  if (id.length !== 4){
    throw Error
  }
  if (flags === null) flags = new Uint8Array([0x00, 0x00]);
  const frameIdBytes = new TextEncoder().encode(id);

  const header = new Uint8Array(FRAME_HEADER_LENGTH)
  header.set(frameIdBytes, 0);
  header.set(writeBE32BitInt(size), 4)
  header.set(flags, 8)
  return header;
}

function decodeId3Text(bytes, encoding) {
  switch (encoding) {
    case 0x00:
      return new TextDecoder(DEFAULT_ENCODING).decode(bytes);
    case 0x01:
      return new TextDecoder("utf-16").decode(bytes);

    case 0x02:
      return new TextDecoder("utf-16be").decode(bytes);
    case 0x03:
      return new TextDecoder("utf-8").decode(bytes);
    default:
      return new TextDecoder("utf-8").decode(bytes);
  }
}

function findNullTerminator(bytes, start, encoding) {
  if (encoding === 0x00) {
    for (let i = start; i < bytes.length; i++){
      if (bytes[i] === 0x00) return i;
    }
    return -1;
  }
  for (let i = start; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0x00 && bytes[i+1] === 0x00) return i;
  }
  return -1;
}

function parseCommentsFrame(bytes) {
  const encoding = bytes[FRAME_HEADER_LENGTH];
  let pos = FRAME_HEADER_LENGTH + 1;
  // skip over language const language = new TextDecoder().decode(bytes.subarray(pos, pos + 3));
  pos += 3;
  pos = findNullTerminator(bytes, pos, encoding);
  if (pos === - 1){

  }
  // const description = decodeId3Text(bytes.subarray(FRAME_HEADER_LENGTH + 1 + 3, pos))
  const terminatorLength = (encoding === 0x00) ? 1: 2;
  return stripTrailingNulls(decodeId3Text(bytes.subarray(pos + terminatorLength), encoding))
}

function parsePictureFrame(bytes) {
  let pos = FRAME_HEADER_LENGTH;
  const encoding = bytes[pos++];
  let nullPos =  findNullTerminator(bytes, pos, 0);
  const mimeType = decodeId3Text(bytes.subarray(pos, nullPos), 0)
  // seek to end of description
  pos = findNullTerminator(bytes, nullPos, encoding); // skip over picture type
  let imgBytes;
  if (mimeType === "image/jpeg") {
    // seek to SOI (start of image) marker
    let j = pos;
    while (bytes[j] !== 0xFF && bytes[j + 1] !== 0xd9) j++;
    imgBytes = bytes.slice(j)
  }
  else if (mimeType === "image/png") {
    // seek to PNG file signature
    let j = pos;
    while (
      bytes[j] !== 0x89 &&  bytes[j + 1] !== 0x50 &&
        bytes[j + 2] !== 0x4e &&  bytes[j + 3] !== 0x47 &&
        bytes[j + 4] !== 0x0D &&  bytes[j + 5] !== 0x0A &&
        bytes[j + 6] !== 0x1A &&  bytes[j + 7] !== 0x0A
      ) j++;
      imgBytes = bytes.slice(j)
  }
  return {mimeType: mimeType, bytes: imgBytes}
}

function parseTextFrame(bytes) {
  const frameSize = bytes.byteLength;
  const decoder = new TextDecoder(ENCODING_LOOKUP[bytes[FRAME_HEADER_LENGTH]]);
  let offset = 1;
  if (decoder.encoding === "utf-16le"){
    offset += 2;     // ignore BOM
  }
  const content = decoder.decode(bytes.slice(
    FRAME_HEADER_LENGTH + offset,
    FRAME_HEADER_LENGTH + offset + frameSize));
  return stripTrailingNulls(content);
}




function writeTextFrame(text, frameId){
  const encodedText = encodeStringToUTF16LE(text);
  const header = createFrameHeader(frameId, encodedText.length + 1);
  const frame = new Uint8Array(FRAME_HEADER_LENGTH + 1 + encodedText.length);
  const view = new DataView(frame.buffer);
  frame.set(header, 0);
  view.setUint8(FRAME_HEADER_LENGTH, 0x01); // set unicode encoding
  frame.set(encodedText, FRAME_HEADER_LENGTH + 1);
  return frame;
}

function writeCustomTextFrame(text, description="") {
  const encoding = 0x01;
  const textBytes = encodeStringToUTF16LE(text);
  const descriptionBytes = encodeStringToUTF16LE(description);
  const descriptionTerminator = new Uint8Array([0x00, 0x00]);
  const body = new Uint8Array(
    1
    + descriptionBytes.length + 2
    + textBytes.length
  )
  let pos = 0;
  body[pos++] = encoding;
  body.set(descriptionBytes, pos); pos += descriptionBytes.length;
  body.set(descriptionTerminator, pos); pos += 2;
  body.set(textBytes, pos);
  const header = createFrameHeader("TXXX", body.length)
  const frame = new Uint8Array(header.length + body.length)
  frame.set(header, 0)
  frame.set(body, header.length)
  return frame;
}


function writeCommentFrame(comment, language="eng", description=""){
  const encodedText = encodeStringToUTF16LE(comment);
  const langBytes =  new TextEncoder().encode(language.slice(0, 3)) // 3 ASCII bytes
  const descriptionBytes = encodeStringToUTF16LE(description);

  const size = 1 + 3 + descriptionBytes.length + UTF_TERMINATOR.length + encodedText.length;
  const header = createFrameHeader("COMM", size);
  const body = new Uint8Array(size);
  let pos = 0;
  body[pos++] = 0x01; // utf-16 encoding
  body.set(langBytes, pos); pos += 3;
  body.set(descriptionBytes, pos); pos += descriptionBytes.length;
  body.set(UTF_TERMINATOR, pos); pos += UTF_TERMINATOR.length;
  body.set(encodedText, pos);
  const frame = new Uint8Array(FRAME_HEADER_LENGTH + body.length)
  frame.set(header, 0)
  frame.set(body, header.length);

  return frame;


}

function writePictureFrame(imageBytes, description="the cover image", pictureType=0x03, mimetype="image/jpeg") {
  const encoding = 0x01; // utf-16 w/ BOM (v2.3)
  const encodedDescription = encodeStringToUTF16LE(description, true);
  const descTerminator = new Uint8Array([0x00, 0x00]);
  const mimeBytes = new TextEncoder().encode(mimetype)
  const mimeTerminator = new Uint8Array([0x00]);

  const body = new Uint8Array(
    1 // encoding byte
    + mimeBytes.length + 1 // ascii-encoded mimetype string + null terminator
    + 1 // picture type
    + encodedDescription.length + 2 // encoded description string with null terminators
    + imageBytes.length
  );
  let pos = 0;
  body[pos++] = encoding; // text encoding
  body.set(mimeBytes, pos); pos += mimeBytes.length;
  body.set(mimeTerminator, pos); pos += 1;
  body[pos++] = pictureType; // picture type (0x03 = Cover (front))
  body.set(encodedDescription, pos); pos += encodedDescription.length;
  body.set(descTerminator, pos); pos += 2;
  body.set(imageBytes, pos);

  const header = createFrameHeader("APIC", body.length)

  const frame = new Uint8Array(header.length + body.length);
  frame.set(header, 0)
  frame.set(body, header.length)

  console.log("written image frame:", frame)
  return frame;
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





function getID3V2EndIndex(u8){
  // check size
  if (u8.length < FRAME_HEADER_LENGTH) return 0;
  // check if id3v2 tag exists
  if (!(u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33)) return 0; // should be "ID3"
  const versionMajor = u8[3];
  if (versionMajor < 3) {
    throw new Error("versions earlier than ID3v2.3.0 not supported")
  }
  const flags = u8[5]; // skip version revision byte
  if ((flags & 0x10) !== 0) {
    alert("extended footer not currently supported")
    throw new Error()
  }
  const size = (u8[6] << 28) | (u8[7] << 14) | (u8[8] << 7) | u8[9];
  const footer = (versionMajor === 4 && (!((flags & 0x10) !== 0))) ? 10 : 0;
  return FRAME_HEADER_LENGTH + size + footer;
}


function id3v23_getMetadata(bytes){
  const metadata = {
    title: '', album: '', artists: '', accompaniment: '', composer: '',
    release_year: new Date().getFullYear(), track_number: 1, disc_number: 1,
    publisher: '', genre: '', picture: null, comments: ''
  };
  const size = bytes.length;
  let pos = FRAME_HEADER_LENGTH;
  while (pos < size) {
    const {id, size} = parseFrameHeader(bytes.subarray(pos, pos + FRAME_HEADER_LENGTH));
    if (!SUPPORTED_FRAMES.has(id)){
      pos += size;
      continue;
    }
    const frame = bytes.subarray(pos, pos + size);
    const key = METADATA_MAP[id];
    let content;
    if (TEXT_INFO_FRAMES.has(id)){
      content = parseTextFrame(frame)
      if (id === "TPOS" || id === "TRCK") {
        content = content.split('/').at(0) // e.g. sometimes TRCK shows up as 2/27
      }
    }
    else if (id === "COMM") {
      content = parseCommentsFrame(frame)
    }
    else if (id === "APIC"){
      const {mimeType, bytes} = parsePictureFrame(frame)
      content = bytes;
      metadata["mimeType"] = mimeType;
    }
    metadata[key] = content;
    pos += size;
  }
  return metadata;
}



document.addEventListener("DOMContentLoaded", function () {

  let objectUrls = []; // track all objectUrls in the app
  const container = document.getElementById("container");
  const fileUploadInput = document.getElementById("file-upload-input");
  async function CreateEditForm(file) {
    const form = document.createElement("form");

    const audioElement = document.createElement("audio");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const audioURL = URL.createObjectURL(file);
    audioElement.src = audioURL;
    // audioElement.play().catch(() => {
    //   /* autoplay may be blocked; user must press play */
    // });
    // audioElement.preload = "auto";
    objectUrls.push(audioURL);
    const tagEnd = getID3V2EndIndex(bytes);
    if (tagEnd === 0)
      alert("incompatible file")
    const audioBytes = bytes.subarray(tagEnd); // keep the pure audio bytes for file creation

    const metadata = id3v23_getMetadata(bytes.subarray(0, tagEnd));
    const itemId = crypto.randomUUID();
    form.appendChild(audioElement)

    form.className = "metadata-form";
    form.id = itemId;
    form.style.width = "100%";
    const formHeader = document.createElement("div");
    formHeader.className = "form-header"
    const fileTitle = document.createElement("div");
    fileTitle.className = "input-group";
    fileTitle.textContent = file.name;
    fileTitle.style.fontSize = "18px";
    fileTitle.style.fontWeight = "bold";
    formHeader.appendChild(fileTitle);
    const playButton = document.createElement("div");
    playButton.classList.add("shape");
    playButton.id = "playBtn"
    function playAudio(audioElement) {
      audioElement.play();
      playButton.classList.remove("triangle");
      playButton.classList.add("square");
      return true;
    }
    function pauseAudio(audioElement) {
      audioElement.pause();
      playButton.classList.remove("square");
      playButton.classList.add("triangle");
      return false;
    }
    let isPlaying = pauseAudio(audioElement); // init in non-playing state

    playButton.style.font = "inherit";
    playButton.onclick = (event) => {
      event.preventDefault();
      isPlaying = (isPlaying) ? pauseAudio(audioElement) : playAudio(audioElement);
    }
    formHeader.appendChild(playButton);
    form.appendChild(formHeader)
    FORM_INPUT_FIELDS.forEach((data) => {
      const template = document.createElement("template");
      template.innerHTML =
        `<div class="input-group">
      <label for="${data.name}-input">${data.name.split('_').join(' ')}</label>
      <input
      type="${data.type}"
      class="input"
      id="${data.name}-input"
        ${(data.type === "number")? 'min=1': ''}
        value='${metadata[data.name]}'>
    </div>`;
      const input = template.content.firstElementChild.children[1];
      // update metadata based on input
      input.addEventListener("input", () => {
        metadata[data.name] = input.value;
      })
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
    }
    const apicSpan = document.createElement("span");
    apicSpan.textContent = "Select a Picture";
    uploadDiv.appendChild(apicSpan);
    const apicInput = document.createElement("input");
    apicInput.type = "file";
    apicInput.hidden = true;
    apicInput.setAttribute("name", "file");
    apicInput.accept = "image/jpeg";
    uploadDiv.addEventListener("click", () => apicInput.click())
    apicInput.addEventListener("change", async () => {
      const file = apicInput.files[0];
      const newFileBytes = new Uint8Array(await file.arrayBuffer());
      metadata.picture = newFileBytes;
      const obj = createDataURLFromBytes(newFileBytes);
      objectUrls.push(obj);
      uploadDiv.style.background = `#fff url(${obj}) center / contain no-repeat`

    })
    uploadDiv.appendChild(apicInput);
    apicDiv.appendChild(uploadDiv)
    form.appendChild(apicDiv);


    // add comments field
    const template = document.createElement("template");
    template.innerHTML = `<div class="input-group">
    <label for="comments">Comments</label>
    <textarea name="comments" id="comments" style="resize: none; height:5em; flex: 3; font-family: inherit; font-size: inherit">${metadata.comments}
</textarea>
  </div>`
    const div = template.content.firstElementChild
    const textarea = div.children[1];
    textarea.addEventListener("input", () => {
      metadata.comments = textarea.value;
    })
    form.append(div)

    const saveButton = document.createElement("a");
    saveButton.innerText = "Save";
    saveButton.id = "save-button";
    saveButton.style.width = "100%";
    saveButton.addEventListener("click", async () => {
      // create mp3 file
      const frames = [writeCustomTextFrame(`created with ${window.location.href}`)];
      for (const key of Object.keys(metadata)){
        const frameId = METADATA_KEY_TO_FRAMEID[key]
        if (TEXT_INFO_FRAMES.has(frameId)){
          frames.push(writeTextFrame(metadata[key], frameId))
        } else if (frameId === "COMM" && metadata.comments !== "") {
          frames.push(writeCommentFrame(metadata[key]));
        } else if (frameId === "APIC" && metadata.picture !== null) {
          frames.push(writePictureFrame(metadata[key]));
        }
      }
      const size = frames.reduce((acc, cur) => acc + cur.length, 0);
      const body = new Uint8Array(size);
      let pos = 0;
      for (const f of frames) {
        body.set(f, pos)
        pos += f.length;
      }
      const header = new Uint8Array(10);
      header.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0) // "ID3", v2.3.0, no flags set
      header.set(encodeSynchSafe(size), 6)
      const outFile = new Blob([header, body, audioBytes ],  {type: "audio/mpeg"})

      const fileUrl = URL.createObjectURL(outFile);

      // prep download for user

      const a = document.createElement("a");
      a.target = "_blank";

      a.download = file.name;
      a.href = fileUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(fileUrl), 0)
    })

    form.appendChild(saveButton);

    return form;
  }
  fileUploadInput.addEventListener("change", () => {
    const files = fileUploadInput.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      CreateEditForm(file)
        .then(form => {
          form.id = `metadata-upload-form-${i}`;
          container.appendChild(form);
        })
    }
    fileUploadInput.value = "";
  })


  window.addEventListener("beforeunload", () => {
    // clean up
    if (objectUrls.length === 0) return;
    objectUrls.forEach((obj) => {
      URL.revokeObjectURL(obj);
    })
    // e.returnValue = '';
  })


})
