const Koa = require('koa');
const Cheerio = require('cheerio');
const Request = require('request');
const Moment = require('moment');
// 注意require('koa-router')返回的是函数:
const router = require('koa-router')();
// koa-bodyparser 解析原始request请求，然后，把解析后的参数，绑定到ctx.request.body中
const bodyParser = require('koa-bodyparser');

const nunjucks = require('./nunjucks.js');
const Booklist = require('./db/config.js').booklist;
const Books = require('./db/config.js').books;

const app = new Koa();

router.get('/', async(ctx, next) => {
	console.log(Booklist)
	ctx.response.body = nunjucks.render('index.html');
})

//  request URL:
let rootUrl = 'http://m.qidian.com/'; 
let classify = 'female'  			// 女生类小说
// let classify = 'male';			// 男生类小说

// 获取两类 booklist
router.get('/booklistSlide', async(ctx, next) => {
    console.log(`.....................`);
    Request(rootUrl + classify, (error, res, body) => {
    	let id = 1;
        if (!error && res.statusCode == 200) {
            $ = Cheerio.load(body);
            $('.module-slide-ol .module-slide-li').each((index, value) => {
            	// 只取前20条
            	if (index < 20) {

            		let bookItem = {
            			id: id++,
						time: Moment(new Date()).add('hours', 8).format('YYYY-MM-DD HH:mm:ss'),
						type: "slide",
						bookName: $(value).find('.module-slide-caption').text(),
						author: $(value).find('.module-slide-author .gray').text(),
						url: `${rootUrl}${$(value).find('.module-slide-a').attr('href')}`,
						imageUrl: `https:${$(value).find('img').attr('data-src')}`,
						intro: "",
						labels: [],	
            		}

			        Booklist.create(bookItem ,(err, data) => {
							if (!err) {
								console.log('save is ok！！！！！！！！！！！！！！！！')
							}else{
								console.error(err);
							}
						}
					)	
	            	
	            }
            })
        }else{
        	console.error(error)
        }
    });
    ctx.response.body = {name: 'ok'};
});

router.get('/booklistUpdae', async(ctx, next) => {
    let booklists = await Booklist.find();   // 经常遇到一次性无法 全部存储文章成功，可分少部分多次存储
  	console.log(`book totall ${booklists.length}`)
  	for(let item of booklists){
	    Request(item.url, async (error, res, body) => {
	        if (!error && res.statusCode == 200) {
	            $ = Cheerio.load(body);
	            let num = Math.ceil(Math.random()*5*100)/100;
	            	num = num < 1 ? (num+2) : num;
	            let bookIdArr = [Math.ceil(Math.random()*100/4), Math.ceil(Math.random()*100/4), Math.ceil(Math.random()*100/4)];
	            let saveData = {
		  			// intro: $('#bookSummary content').text(),
		  			// score: num,
		  			recommendBook: bookIdArr
		  			// labels: [{tag: '连载'}, {tag: (Math.ceil(Math.random()*20)+'万字')}] 
		  		}
	            
  				await Booklist.update({id: item.id}, saveData);
		        
	        }else{
	        	console.error(error)
	        }
	    });
  	}
  	console.log('ok......')
    ctx.response.body = {name: 'ok'};
});

router.get('/booklistDesc', async(ctx, next) => {
    console.log(`.....................`);
    Request(rootUrl + classify, (error, res, body) => {
    	let id = 21;
        if (!error && res.statusCode == 200) {
            $ = Cheerio.load(body);
            $('.book-ol-normal .book-li').each((index, value) => {
            	if (index < 20) {
            		let bookItem = {
	            		id: id++,
	            		time: Moment(new Date()).add('hours', 8).format('YYYY-MM-DD HH:mm:ss'),
	            		type: "desc",
	            		url: `${rootUrl}${$(value).find('.book-layout').attr('href')}`,
	            		imageUrl:`http:${$(value).find('.book-layout img').attr('data-src')}`,
	            		bookName: $(value).find('.book-title').text(),
	            		author: $(value).find('.book-author').text(),
	            		intro: $(value).find('.book-desc').text().replace("作者：", ""),
	            		labels: [
	            			{tag: $(value).find('.book-meta-r .gray').text()},
	            			{tag: $(value).find('.book-meta-r .red').text()},
	            			{tag: $(value).find('.book-meta-r .blue').text()},
	            		]	
	            	}
	            	// console.log(data)
			        Booklist.create(bookItem ,(err, data) => {
							if (!err) {
								console.log('save is ok！！！！！！！！！！！！！！！！')
							}else{
								console.error(err);
							}
						}
					)	
	            }
            })
	        
        }else{
        	console.error(error)
        }
    });
    ctx.response.body = {name: 'ok'};
});


// 根据 booklist 获取文章内容
router.get('/books', async(ctx, next) => {
	await saveArticle();
    ctx.response.body = {name: 'ok'};
});


async function saveArticle(){
	let booklists = await Booklist.find({id:'desc'});   // 经常遇到一次性无法 全部存储文章成功，可分少部分多次存储
	let processing = 1;  // 创建 book id 也是存储进程数
  	console.log(`book totall ${booklists.length}`)
  	for(let item of booklists){
  		let saveData = {
  				id: item.id,
	  			chapters: await getChapters(item.url)
	  		}
  		Books.create(saveData, (err, data) => {
			if (!err) {
				console.log('.........' + item.bookName + '............save is ok！article_process........' + booklists.length+'====='+ processing++ + '......................');
			}else{
				console.error(err);
			}
		})
  	}
  	console.log("全部书已存储完毕................................................................................")
}

// 获取小说章节存储
function getChapters(url){
	return new Promise((resolve, reject) => {
		Request(`${url}/catalog`, (error, res, body) => {
			let data = [];
	    	let id = 1;
	        if (!error && res.statusCode == 200) {
	            $ = Cheerio.load(body);
	            let i = 0;
	            let chapterOvj = $('#catelogX .jsChapter');

	            chapterOvj.each(async(index, value) => {
	            	let contentId = $(value).find('a').attr('data-chapter-id');
	            	i++;
	            	data.push({
	            		chapterId: (i-1),
	            		title: $(value).find('span').text(),
	            		content: await getContent(`${url}/${contentId}`, i),
	            	});

	            	// each 内为 async 所以 只有判断 $('#catelogX .jsChapter')和data的长度相等后 在resolve
	            	if (chapterOvj.length == data.length) {
	            		console.log('article content is finishied............' + chapterOvj.length + '=====' + data.length)
	        			resolve(data);
	            	}else{
	            		console.log('........chapter_processing......' + chapterOvj.length + '=====' + data.length)
	            	}
	            })
	        }else{
	        	reject(error)
	        }
		})
	})
}

// 获取章节内容
function getContent(url, index,){
	return new Promise((resolve, reject) => {
		Request(url, (error, res, body) => {
			let content = '';
	        if (!error && res.statusCode == 200) {
	            $ = Cheerio.load(body);
	            content = reconvert($('#readContent .read-section').html());
	            content = trim(content);
	            console.log('a chapter is ok...'+index)
	        	resolve (content);
	        }else{
	        	reject(error)
	        }
		})
		
	})
}

// 去空格
function trim(str) {
  return str.replace(/(^\s*)|(\s*$)/g, '').replace(/&nbsp;/g, '')
}

//将Unicode转汉字
function reconvert(str) {
  str = str.replace(/(&#x)(\w{1,4});/gi, function ($0) {
    return String.fromCharCode(parseInt(escape($0).replace(/(%26%23x)(\w{1,4})(%3B)/g, "$2"), 16));
  });
  return str
}

// 在合适的位置加上：由于middleware的顺序很重要，这个koa-bodyparser必须在router之前被注册到app对象上。
app.use(bodyParser());

// 使用middleware:
app.use(router.routes());

// 在端口3000监听:
app.listen(3333);
console.log('app started at port 3333...');