var fs = require('fs');
var cheerio = require('cheerio');
var _ = require('lodash');
var readline = require('readline');

var rl = readline.createInterface({
  input:process.stdin,
  output:process.stdout
});

var pbcopy = function (data) {
  var proc = require('child_process').spawn('pbcopy');
  proc.stdin.write(data);
  proc.stdin.end();
  return data;
};

rl.setPrompt('> ');
rl.prompt();
rl.on('line', function(line){
  var child = require('child_process').spawn('pbpaste');
  var data = [];
  child.stdout
    .on("data", function(chunk) {
      data.push(chunk);
    })
    .on("end",function(){
      if(!Array.isArray(data)) { data = [ data ]; }
      data = Buffer.concat(data).toString("utf8");
      copyScss(data);
      rl.prompt();
    });
});

function copyScss(htmlData) {
  var $ = cheerio.load(htmlData, {
    decodeEntities: false,
    ignoreWhitespace: false
  });

  var childList = $.root().children();

  var validTags = [];

  for (var i = 0; i < childList.length; i++) {
    removeNone(childList[i]);
  }

  function removeNone(child) {
    if ((typeof child.attribs == 'object') && (typeof child.attribs.class == 'string')) {
      validTags.push(child);
    } else {
      if (child.children && child.children.length > 0) {
        for (var j = 0; j < child.children.length; j++) {
          removeNone(child.children[j]);
        }
      }
    }
  }

  if(validTags.length < 1){
    console.log('HTML tag is not exist');
    return;
  }
  var resultList = [];

  for (var i = 0; i < validTags.length; i++) {
    var result = getClass(validTags[i]);

    if (JSON.stringify(result) != '{}') {
      resultList.push(result);
    }
  }

  function getClass(child) {
    if (child.children && child.children.length > 0) {
      var dataList = [];
      for (var i = 0; i < child.children.length; i++) {
        var data = getClass(child.children[i]);
        if (JSON.stringify(data) != '{}') {
          if (data.class) {
            dataList.push(data);
          } else {
            for (var j = 0; j < data.child.length; j++) {
              dataList.push(data.child[j]);
            }
          }
        }
      }

      var nestedList = [];
      for (var i = 0; i < dataList.length; i++) {
        var index = _.findIndex(nestedList, function (data) {
          return data.class == dataList[i].class;
        });

        if (index < 0) {
          nestedList.push(dataList[i]);
        } else {
          nestedList[index].child = nestedList[index].child.concat(dataList[i].child);
        }
      }

      if ((typeof child.attribs == 'object') && (typeof child.attribs.class == 'string')) {
        return {
          class: child.attribs.class,
          child: nestedList
        }
      } else {
        return {
          class: '',
          child: nestedList
        }
      }
    } else {
      if ((typeof child.attribs == 'object') && (typeof child.attribs.class == 'string')) {
        return {
          class: child.attribs.class,
          child: []
        }
      } else {
        return {};
      }
    }
  }

  var scssList = [];

  for (var i = 0; i < resultList.length; i++) {
    var finded = false;
    for (var j = 0; j < scssList.length; j++) {
      var data = find(resultList[i], scssList[j]);
      if (data) {
        finded = data;
        break;
      }
    }
    if (!finded) {
      scssList.push(resultList[i]);
    }
  }

  function find(target, resource) {
    if (target.class == resource.class) {
      if (target.child.length == 0 && resource.child.length == 0) {
        return true;
      } else if (target.child.length == 0 && resource.child.length > 0) {
        return true;
      } else if (target.child.length > 0 && resource.child.length == 0) {
        resource.child = target.child;
        return true;
      } else if (target.child.length > 0 && resource.child.length > 0) {
        var isConcat = true;
        var concatList = [];
        for (var i = 0; i < target.child.length; i++) {
          for (var j = 0; j < resource.child.length; j++) {
            isConcat = find(target.child[i], resource.child[j]);
            if (!isConcat) {
              concatList.push(target.child[i]);
            }
          }
        }
        resource.child = resource.child.concat(concatList);
        return true;
      }
    } else {
      return false;
    }
  }

  var resultString = '';

  for (var i = 0; i < scssList.length; i++) {
    printResult(scssList[i]);
  }

  function printResult(obj) {
    resultString += '.' + obj.class.split(" ").join('.');
    resultString += ' {\n';
    if (obj.child.length > 0) {
      for (var i = 0; i < obj.child.length; i++) {
        printResult(obj.child[i]);
      }
    }
    resultString += '}\n';
  }

  pbcopy(resultString);
  console.log('클림보드로 복사되었습니다.');
}
