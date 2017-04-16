/*
Adapted from https://github.com/brotchie/protobuf-textformat

-----

The MIT License (MIT)

Copyright (c) 2014 James Brotchie <brotchie@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Parsimmon = require('parsimmon');

var regex = Parsimmon.regex
  , string = Parsimmon.string
  , optWhitespace = Parsimmon.optWhitespace
  , lazy = Parsimmon.lazy
  , alt = Parsimmon.alt
  , seq = Parsimmon.seq;

var comment = regex(/#.+/).then(optWhitespace.atMost(1));
var whitespace = optWhitespace.then(comment.atMost(1));

var lexeme = function(p){ return p.skip(whitespace); };

var colon = lexeme(string(':'));

var lbrace = lexeme(string('{'))
  , rbrace = lexeme(string('}'));

var stripFirstLast = function(x) {
  return x.substr(1, x.length-2);
};

var identifier = lexeme(regex(/[a-zA-Z_][0-9a-zA-Z_+-]*/));
var doubleString = lexeme(regex(/\"([^\"\n\\\\]|\\\\.)*(\"|\\\\?$)/).map(stripFirstLast));
var singleString = lexeme(regex(/\'([^\'\n\\\\]|\\\\.)*(\'|\\\\?$)/).map(stripFirstLast));

var number = lexeme(regex(/[.]?[0-9+-][0-9a-zA-Z_.+-]*/)).map(Number);
var trueLiteral = lexeme(string('true')).result(true);
var falseLiteral = lexeme(string('false')).result(false);

var expr = lazy('an expression', function() { return alt(pair, message).many(); });

var message = seq(identifier, colon.times(0, 1).then(lbrace).then(expr).skip(rbrace))
  .map(function(message) {
    return { type: 'message', name: message[0], values: message[1] };
  });

var value = alt(trueLiteral, falseLiteral, number, doubleString, singleString, identifier);

var pair = seq(identifier.skip(colon), value)
  .map(function(pair) {
    return { type: 'pair', name: pair[0], value: pair[1] };
  });

function parse(input) {
  var result = whitespace.then(expr).parse(input);
  if (!result.status) {
    result.error = Parsimmon.formatError(input, result);
  }
  return result;
};


function buildMessageFromAST(message, ast) {
  ast.map(function(entry) {
    var value;
    var field = message.$type.getChild(entry.name);
    if (entry.type === 'pair') {
      value = entry.value;
    } else if (entry.type === 'message') {
      var ChildMessageClass = field.resolvedType.build();
      var value = new ChildMessageClass();
      buildMessageFromAST(value, entry.values);
    }

    if (field.repeated) {
      message.add(entry.name, value);
    } else {
      message.set(entry.name, value);
    }
  });
};

module.exports.parse = function(MessageClass, input) {
  var message = new MessageClass();

  var result = parse(input);

  if (result.status) {
    buildMessageFromAST(message, result.value);
    result.message = message;
  }
  return result;
};

