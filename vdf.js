/*
adapted from https://github.com/seishun/node-steam

Copyright (c) 2013 seishun <vvnicholas@gmail.com>
 
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var ByteBuffer = require('bytebuffer');


var Type = {
  None: 0,
  String: 1,
  Int32: 2,
  Float32: 3,
  Pointer: 4,
  WideString: 5,
  Color: 6,
  UInt64: 7,
  End: 8,
};

exports.decode = function(buffer) {
  var object = {};
  if(typeof(buffer.readUint8) != "function"){
    buffer = ByteBuffer.wrap(buffer);
  }
  if(buffer.offset != buffer.limit) {
    while (true) {
      var type = buffer.readUint8();

      if (type == Type.End)
        break;

      var name = buffer.readCString();

      switch (type) {
        case Type.None:
          object[name] = exports.decode(buffer);
          break;

        case Type.String:
          object[name] = buffer.readCString();
          break;

        case Type.Int32:
        case Type.Color:
        case Type.Pointer:
          object[name] = buffer.readInt32();
          break;

        case Type.UInt64:
          object[name] = buffer.readUint64();
          break;

        case Type.Float32:
          object[name] = buffer.readFloat();
          break;
      }
    }
  }

  return object;
};

function _encode(object, buffer, name){
  switch (typeof object) {
    case 'object':
      buffer.writeByte(Type.None);
      buffer.writeCString(name);
      for (var index in object) {
        _encode(object[index], buffer, index);
      }
      buffer.writeByte(Type.End);
      break;
    case 'string':
      buffer.writeByte(Type.String);
      buffer.writeCString(name);
      buffer.writeCString(object ? object : null);
      break;
    case 'number':
      buffer.writeByte(Type.String);
      buffer.writeCString(name);
      buffer.writeCString(object.toString());
      break;
  }
}
exports.encode = function(object){
  if(!buffer){
    var buffer = new ByteBuffer();
  }
  for(var item in object){
    if(object.hasOwnProperty(item)) {
      _encode(object[item], buffer, item);
    }
  }
  buffer.writeByte(Type.End);
  buffer.flip();
  return buffer;
};
