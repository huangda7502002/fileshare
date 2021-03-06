import * as Express from 'express';
import * as fs from 'fs';
import * as moment from 'moment';
import * as path from 'path';
import { promisify } from 'util';
import cbFunc from '../cb/cb';
import db from '../db/basic';
import query from '../db/query';
import queryFile from '../db/queryFile';

export class File {
  public static dir: string;
  public static setDir(dir: string) {
    File.dir = dir;
  }
  private filename: string;
  private hash: string;
  private readonly types = {
    doc: 'doc/docx/txt/xls/xlsx/ppt/pptx',
    image: 'jpg/png/gif/jpeg/svg/ico',
    video: 'avi/mpeg/divx/wmv/cda/mp3/mid/wave',
    zip: 'zip/rar',
  };
  constructor(filename: string, hash: string) {
    this.filename = filename;
    this.hash = hash;
  }

  public async insert(type: string, size: number, userid: number) {
    let con = await db('cloud');
    let value =
      '(\'' +
      this.filename +
      '\', \'' +
      type +
      '\',\'' +
      size +
      '\',\'' +
      this.hash +
      '\')';
    let sql =
      'insert into pending_file(filename, type, size, hash) values ' +
      value +
      ';';
    const result = await query(sql, con);
    const date = new Date();
    const dateTime = moment(date).format('YYYY-MM-DD HH:mm:ss');
    con.end();
    con = await db('cloud');
    value = '(\'' + result.insertId + '\', \'' + userid + '\',\'' + dateTime + '\')';
    sql = 'insert into user_file(file, user, upload_at) values ' + value + ';';
    await query(sql, con);
    con.end();
  }

  public async upload(file: object, req: any, res: any) {
    let type = '';
    // 根据文件名后缀获取文件格式
    for (const k in this.types) {
      if (this.types[k].includes(file.extension.toLowerCase())) {
        type = k;
        break;
      }
    }
    if (type === '') {
      type = 'other';
    }
    await this.insert(type, file.size, req.session.userid || 0);
    res.json('上传成功');
  }

  public download(res: any) {
    const fsexists = promisify(fs.exists);
    // ------------------等其他两组提交后再将file改成变量
    const currFile = path.resolve(process.env.UPLOAD_DIR, this.filename);
    fsexists(currFile).then((exist: any) => {
      if (exist) {
        const f = fs.createReadStream(currFile);
        res.writeHead(200, {
          'Content-Disposition':
            'attachment; filename=' + encodeURI(this.filename),
          'Content-Type': 'application/force-download',
        });
        f.pipe(res);
      } else {
        res.set('Content-type', 'text/html');
        res.send('file not exist!');
        res.end();
      }
    });
  }
  public async getFiles(req: any, res: any, sql: string) {
    const con = await db('cloud');
    const result = await query(sql, con);
    con.end();
    res.json(result);
  }

  public async getType(req: any, res: any, type: string) {
    const con = await db('cloud');
    const sql =
      'select user.username,file.filename,file.size,file.downloads ' +
      'from file left join user_file on user_file.file = file.id ' +
      'left join user on user.id = user_file.user where file.type = \'' +
      type +
      '\' order by file.downloads DESC';
    const result = await query(sql, con);
    con.end();
    res.json(result);
  }
}
