
////////////////////////////////
// 主物件
////////////////////////////////

function chessEngine(fen, testMode, addEP) {
	this.moveHis=new Array();			// 到目前為止走過的棋步清單（文字模式）
	this.positionHis=[fen];				// 所有到目前為止每一步的 FEN
	this.legalMovesHis=new Array();		// 到目前為止每一步之後的合法棋步清單（文字模式）
	this.legalMovesSysHis=new Array();	// 到目前為止每一步之後的合法棋步清單（系統模式）

	this.testMode=(testMode==null?false:true);
	this.addEP=(addEP==null?true:false);

	this.position=[
		[8,9,10,11,12,10,9,8],
		[7,7,7,7,7,7,7,7],
		[0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0],
		[1,1,1,1,1,1,1,1],
		[2,3,4,5,6,4,3,2]
	];									// 目前的局面（系統模式）
	this.whoseMove=1;					// 目前該誰下（0 黑 1 白）
	this.castlingState=[1,1,1,1];		// 入堡許可狀態
	this.enPassantState=[-1,-1];		// 吃過路兵可行格
	this.halfmoveClock=0;				// 自從前一次吃子或動兵以來的單步計數器
	this.fullmoveClock=1;				// 目前的回合數

	this.legalMoves=new Array();		// 目前的合法棋步清單（文字模式）
	this.legalMovesSys=new Array();		// 目前的合法棋步清單（系統模式）
	
	this.fromFEN=chessEngine_fromFEN;
	this.toFEN=chessEngine_toFEN;
	this.retract=chessEngine_retract;
	this.play=chessEngine_play;
	this.playSys=chessEngine_playSys;

	this.checkCheckState=chessEngine_checkCheckState;
	this.computeLegalMoves=chessEngine_computeLegalMoves;
	this.testMove=chessEngine_testMove;
	this.moveToPGN=chessEngine_moveToPGN;
	this.PGN=chessEngine_PGN;

	this.fromFEN(fen);
	this.startMove=this.fullmoveClock;
	this.startSide=this.whoseMove;

	if(!testMode) this.computeLegalMoves();

	return this;
}

////////////////////////////////
// 座標處理函數
////////////////////////////////

function inBoard(i, j) { return 0<=i&&i<8&&0<=j&&j<8;}
function toCoordinate(sq) {
	var a=new Array();
	if(sq=="-") return [-1,-1];
	a[0]=8-eval(sq.substr(1,1));
	a[1]=sq.charCodeAt(0)-97;
	return a;
}
function toSquare(i, j) {
	if(i=="-1") return "-";
	i=8-i; return toColumn(j)+i;
}
function toColumn(j) { return String.fromCharCode(97+j);}

////////////////////////////////
// FEN 處理函數
////////////////////////////////

function chessEngine_fromFEN(fen) {
	var i, j;
	fen=fen.split(" ");
	fen[0]=fen[0].replace(/\d/g, function($0) {
		var a=eval($0), t=""; for(var i=0;i<a;i++) t+=" "; return t;
	});
	fen[0]=fen[0].split("/");
	for(i=0;i<8;i++) {
		fen[0][i]=fen[0][i].split("");
		for(j=0;j<8;j++) this.position[i][j]=pieceIndex[fen[0][i][j]];
	}

	this.whoseMove=(fen[1]=="w"?1:0);
	
	this.castlingState=[0,0,0,0];
	if(fen[2]!="-") {
		fen[2]=fen[2].split("");
		for(i=0;i<fen[2].length;i++) {
			if(fen[2][i]=="K") this.castlingState[0]=1;
			if(fen[2][i]=="Q") this.castlingState[1]=1;
			if(fen[2][i]=="k") this.castlingState[2]=1;
			if(fen[2][i]=="q") this.castlingState[3]=1;
		}
	}

	this.enPassantState=toCoordinate(fen[3]);
	this.halfmoveClock=eval(fen[4]);
	this.fullmoveClock=eval(fen[5]);
}
function chessEngine_toFEN() {
	var i, j, t="", c;
	for(i=0;i<8;i++) {
		for(j=0;j<8;j++) {
			if(this.position[i][j]>0) t+=pieceName[this.position[i][j]];
			else {
				c=1;
				while(j<8&&this.position[i][j+1]==0) { j++; c++;}
				t+=c;
			}
		}
		if(i<7) t+="/";
	}
	t+=" "+(this.whoseMove?"w":"b");
	
	t+=" ";
	if(!(this.castlingState[0]||this.castlingState[1]||
		this.castlingState[2]||this.castlingState[3])) t+="-";
	if(this.castlingState[0]) t+="K";
	if(this.castlingState[1]) t+="Q";
	if(this.castlingState[2]) t+="k";
	if(this.castlingState[3]) t+="q";

	t+=" "+toSquare(this.enPassantState[0], this.enPassantState[1]);
	t+=" "+this.halfmoveClock+" "+this.fullmoveClock;

	return t;
}

////////////////////////////////
// 行棋函數
////////////////////////////////

function chessEngine_retract() {
	if(!this.moveHis.length) return;
	this.moveHis.pop();
	this.positionHis.pop();
	this.legalMovesHis.pop();
	this.legalMovesSysHis.pop();
	this.fromFEN(this.positionHis[this.positionHis.length-1]);
	this.legalMoves=this.legalMovesHis[this.legalMovesHis.length-1];
	this.legalMovesSys=this.legalMovesSysHis[this.legalMovesSysHis.length-1];
}
function chessEngine_play(i) {
	this.moveHis.push(this.legalMoves[i])
	this.playSys(this.legalMovesSys[i]);
}
function chessEngine_playSys(a) {
	var i, j, I=a[0]+a[2], J=a[1]+a[3];
	var k=this.position[a[0]][a[1]];
	var c=this.position[I][J];

	this.position[a[0]][a[1]]=0;
	this.position[I][J]=k;

	// 入堡

	if(k==6&&a[3]==2) { this.position[7][7]=0; this.position[7][5]=2;}
	if(k==6&&a[3]==-2) { this.position[7][0]=0; this.position[7][3]=2;}
	if(k==12&&a[3]==2) { this.position[0][7]=0; this.position[0][5]=8;}
	if(k==12&&a[3]==-2) { this.position[0][0]=0; this.position[0][3]=8;}

	// 兵特殊棋步

	if(k==1&&a[4]<0) this.position[I+1][J]=0;
	if(k==7&&a[4]<0) this.position[I-1][J]=0;
	if((k==1||k==7)&&a[4]>0) this.position[I][J]=a[4];

	// 入堡狀態更新

	if(k==6) this.castlingState[0]=this.castlingState[1]=0;
	if(k==12) this.castlingState[2]=this.castlingState[3]=0;
	if(k==2) {
		if(a[0]==7&&a[1]==0) this.castlingState[1]=0;
		if(a[0]==7&&a[1]==7) this.castlingState[0]=0;
	}
	if(k==8) {
		if(a[0]==0&&a[1]==0) this.castlingState[3]=0;
		if(a[0]==0&&a[1]==7) this.castlingState[2]=0;
	}
	if(I==0&&J==0) this.castlingState[3]=0;
	if(I==0&&J==7) this.castlingState[2]=0;
	if(I==7&&J==0) this.castlingState[1]=0;
	if(I==7&&J==7) this.castlingState[0]=0;	

	// 吃過路兵狀態更新
	
	if(k==1&&a[2]==-2) this.enPassantState=[a[0]-1,a[1]];
	else if(k==7&&a[2]==2) this.enPassantState=[a[0]+1,a[1]];
	else this.enPassantState=[-1,-1];

	// 其他狀態更新

	if(k==1||k==7||c) this.halfmoveClock=0; else this.halfmoveClock++;
	this.whoseMove=1-this.whoseMove;
	if(this.whoseMove) this.fullmoveClock++;

	this.positionHis.push(this.toFEN());
	if(!this.testMode) this.computeLegalMoves();
}

////////////////////////////////
// 合法棋步計算
////////////////////////////////

function chessEngine_checkCheckState(s) {
	var i, j, I, J, k, p, m, M;
	k=s?6:12; m=s?7:1; M=s?12:6;
	for(i=0;i<8;i++) for(j=0;j<8;j++)
		if(this.position[i][j]==k) { I=i; J=j; i=8; j=8;}
	for(k=m;k<=M;k++) {
		p=pieceRule[k];
		if(p[0]==0) {
			for(i=1;i<p.length;i++)
				if(inBoard(I-p[i][0], J-p[i][1]))
					if(this.position[I-p[i][0]][J-p[i][1]]==k) return true;
		} else {
			for(i=1;i<p.length;i++) for(j=1;j<8;j++)
				if(inBoard(I-p[i][0]*j, J-p[i][1]*j)) {
					if(this.position[I-p[i][0]*j][J-p[i][1]*j]==0) continue;
					else {
						if(this.position[I-p[i][0]*j][J-p[i][1]*j]==k) return true;
						break;
					}
				} else break;
		}
	}
	return false;
}
function chessEngine_computeLegalMoves() {
	var i, j, k, l, d, L=new Array(), p;
	var O1=new Array(), O2=new Array();
	var s=this.whoseMove;

	for(i=0;i<8;i++) for(j=0;j<8;j++) {
		k=this.position[i][j];
		if(side(k)==s) {

			// 小兵棋步

			if(k==1) {
				if(this.position[i-1][j]==0) {
					if(i>1) L.push([i, j, -1, 0, 0]);
					else for(l=2;l<=5;l++) L.push([i, j, -1, 0, l]);
					if(i==6&&this.position[i-2][j]==0) L.push([i, j, -2, 0, 0]);
				}
				if(inBoard(i-1,j-1)) if(side(this.position[i-1][j-1])==0||(i-1==this.enPassantState[0]&&j-1==this.enPassantState[1])) {
					if(i>1) L.push([i, j, -1, -1, this.position[i-1][j-1]?0:-1]);
					else for(l=2;l<=5;l++) L.push([i, j, -1, -1, l]);
				}
				if(inBoard(i-1,j+1)) if(side(this.position[i-1][j+1])==0||(i-1==this.enPassantState[0]&&j+1==this.enPassantState[1])) {
					if(i>1) L.push([i, j, -1, 1, this.position[i-1][j+1]?0:-1]);
					else for(l=2;l<=5;l++) L.push([i, j, -1, 1, l]);
				}
			}
			if(k==7) {
				if(this.position[i+1][j]==0) {
					if(i<6) L.push([i, j, 1, 0, 0]);
					else for(l=8;l<=11;l++) L.push([i, j, 1, 0, l]);
					if(i==1&&this.position[i+2][j]==0) L.push([i, j, 2, 0, 0]);
				}
				if(inBoard(i+1,j-1)) if(side(this.position[i+1][j-1])==1||(i+1==this.enPassantState[0]&&j-1==this.enPassantState[1])) {
					if(i<6) L.push([i, j, 1, -1, this.position[i+1][j-1]?0:-1]);
					else for(l=8;l<=11;l++) L.push([i, j, 1, -1, l]);
				}
				if(inBoard(i+1,j+1)) if(side(this.position[i+1][j+1])==1||(i+1==this.enPassantState[0]&&j+1==this.enPassantState[1])) {
					if(i<6) L.push([i, j, 1, 1, this.position[i+1][j+1]?0:-1]);
					else for(l=8;l<=11;l++) L.push([i, j, 1, 1, l]);
				}
			}

			// 入堡棋步

			if(k==6) {
				if(this.castlingState[0]&&this.position[i][j+1]==0&&this.position[i][j+2]==0
					&&!this.checkCheckState(1)&&this.testMove([i, j, 0, 1])) L.push([i, j, 0, 2]);
				if(this.castlingState[1]&&this.position[i][j-1]==0&&this.position[i][j-2]==0&&this.position[i][j-3]==0
					&&!this.checkCheckState(1)&&this.testMove([i, j, 0, -1])) L.push([i, j, 0, -2]);
			}
			if(k==12) {
				if(this.castlingState[2]&&this.position[i][j+1]==0&&this.position[i][j+2]==0
					&&!this.checkCheckState(0)&&this.testMove([i, j, 0, 1])) L.push([i, j, 0, 2]);
				if(this.castlingState[3]&&this.position[i][j-1]==0&&this.position[i][j-2]==0&&this.position[i][j-3]==0
					&&!this.checkCheckState(0)&&this.testMove([i, j, 0, -1])) L.push([i, j, 0, -2]);
			}

			// 普通棋步

			if(k!=1&&k!=7) {
				p=pieceRule[k];
				if(p[0]==0) {
					for(l=1;l<p.length;l++)
						if(inBoard(i+p[l][0], j+p[l][1]))
							if(side(this.position[i+p[l][0]][j+p[l][1]])!=s) L.push([i, j, p[l][0], p[l][1]]);
				} else {
					for(l=1;l<p.length;l++) for(d=1;d<8;d++)
						if(inBoard(i+p[l][0]*d, j+p[l][1]*d)) {
							if(this.position[i+p[l][0]*d][j+p[l][1]*d]==0) L.push([i, j, p[l][0]*d, p[l][1]*d]);
							else {
								if(side(this.position[i+p[l][0]*d][j+p[l][1]*d])!=s) L.push([i, j, p[l][0]*d, p[l][1]*d]);
								break;
							}
						} else break;
				}
			}
		}
	}

	for(i=0;i<L.length;i++) {
		p=this.testMove(L[i]);
		if(p) {
			O1.push(L[i]);
			if(this.testMode) break;					// 如果是測試模式的話，找到一個合法的棋步就可以結束了
			else O2.push(this.moveToPGN(L[i], p));
		}
	}
	this.legalMovesSys=O1;
	this.legalMoves=O2;
	this.legalMovesSysHis.push(O1);
	this.legalMovesHis.push(O2);
}
function chessEngine_testMove(a) {
	var fen=this.positionHis[this.positionHis.length-1];
	var TEN=new chessEngine(fen, true, this.addEP);
	var s=TEN.whoseMove;
	TEN.playSys(a);

	if(TEN.checkCheckState(s)) return 0;

	if(!this.testMode) {
		TEN.computeLegalMoves();
		if(TEN.checkCheckState(1-s)) return TEN.legalMovesSys.length?2:3;
		else return TEN.legalMovesSys.length?1:4;
	} else return 1;
}

////////////////////////////////
// 棋步轉換
////////////////////////////////

function chessEngine_moveToPGN(a, tag) {
	var k, t="", p, L, c0, c1;
	var i, j, I=a[0]+a[2], J=a[1]+a[3];

	k=this.position[a[0]][a[1]];	// 準備要移動的棋子類別
	
	if(k==6||k==12) {				// 國王特殊語法
		if(a[3]==2) t="O-O";
		else if(a[3]==-2) t="O-O-O";
		else {
			t=pieceName[k].toUpperCase();
			if(this.position[I][J]>0) t+="x"
			t+=toSquare(I, J);
		}
	}
	else if(k==1||k==7) {			// 小兵特殊語法
		if(a[3]==0) t=toSquare(I, J);
		else {
			t=toColumn(a[1]);
			if(this.position[I][J]>0||a[4]==-1) t+="x"
			t+=toSquare(I, J);
			if(this.addEP&&a[4]==-1) t+="ep";
		}
		if(a[4]>0) t+="="+pieceName[a[4]].toUpperCase();
	}
	else {							// 其餘棋子語法
		t=pieceName[k].toUpperCase();

		// 檢查有沒有別的同種棋子也可以到達目的地

		L=new Array();
		p=pieceRule[k];
		if(p[0]==0) {
			for(i=1;i<p.length;i++)
				if(inBoard(I-p[i][0], J-p[i][1]))
					if(this.position[I-p[i][0]][J-p[i][1]]==k &&
						this.testMove([I-p[i][0], J-p[i][1], p[i][0], p[i][1]]))
						L.push([I-p[i][0], J-p[i][1]]);
		} else {
			for(i=1;i<p.length;i++) for(j=1;j<8;j++)
				if(inBoard(I-p[i][0]*j, J-p[i][1]*j)) {
					if(this.position[I-p[i][0]*j][J-p[i][1]*j]==0) continue;
					else {
						if(this.position[I-p[i][0]*j][J-p[i][1]*j]==k &&
							this.testMove([I-p[i][0]*j, J-p[i][1]*j, p[i][0]*j, p[i][1]*j]))
							L.push([I-p[i][0]*j, J-p[i][1]*j]);
						break;
					}
				} else break;
		}

		// 如果有別的同種棋子可到達目的地，添加消歧義語法

		if(L.length>1) {
			c0=0; c1=0;
			for(i=0;i<L.length;i++) {
				if(L[i][0]==a[0]) c0++;
				if(L[i][1]==a[1]) c1++;
			}
			if(c1==1) t+=toColumn(a[1]);
			else if(c0==1) t+=8-a[0];
			else t+=toSquare(a[0], a[1]);
		}

		if(this.position[I][J]>0||a[4]==-1) t+="x"
		t+=toSquare(I, J);
	}

	if(tag==2) t+="+";
	if(tag==3) t+="#";
	if(tag==4) t+="";	// 逼和實際上並不會加上 =，所以去掉這個。
	return t;
}
function chessEngine_PGN() {
	var i, j=1, t="";
	for(i=0;i<this.moveHis.length;i++) {
		if(!i||i%2!=this.startSide) { t+=(j+this.startMove-1)+(!this.startSide&&!i?"...":"."); j++;}
		t+=this.moveHis[i]+" ";
	}
	return t;
}

////////////////////////////////
// 行棋規則
////////////////////////////////

function side(k) { return k==0?-1:(0<k&&k<7?1:0);}

var pieceName=[" ", "P", "R", "N", "B", "Q", "K", "p", "r", "n", "b", "q", "k"];
var pieceIndex={" ":0, "P":1, "R":2, "N":3, "B":4, "Q":5, "K":6, "p":7, "r":8, "n":9, "b":10, "q":11, "k":12};
var pieceRule=[
	null,
	[0, [-1,-1], [-1,1]],													// "P"
	[1, [0,-1], [0,1], [-1,0], [1,0]],										// "R"
	[0, [-1,-2], [1,-2], [2,-1], [2,1], [1,2], [-1,2], [-2,1], [-2,-1]],	// "N"
	[1, [-1,-1], [1,1], [-1,1], [1,-1]],									// "B"
	[1, [0,-1], [0,1], [-1,0], [1,0], [-1,-1], [1,1], [-1,1], [1,-1]],		// "Q"
	[0, [0,-1], [0,1], [-1,0], [1,0], [-1,-1], [1,1], [-1,1], [1,-1]],		// "K"
	[0, [1,-1], [1,1]],														// "p"
	[1, [0,-1], [0,1], [-1,0], [1,0]],										// "r"
	[0, [-1,-2], [1,-2], [2,-1], [2,1], [1,2], [-1,2], [-2,1], [-2,-1]],	// "n"
	[1, [-1,-1], [1,1], [-1,1], [1,-1]],									// "b"
	[1, [0,-1], [0,1], [-1,0], [1,0], [-1,-1], [1,1], [-1,1], [1,-1]],		// "q"
	[0, [0,-1], [0,1], [-1,0], [1,0], [-1,-1], [1,1], [-1,1], [1,-1]]		// "k"
];

////////////////////////////////
// 棋步格式說明
////////////////////////////////

/*

陣列一共有五個元素

i,j		原始的位置
i',j'	要移動的向量
k		附加資訊，針對小兵移動的時候用的，每個數值代表：
		-1	吃過路兵
		0	正常移動（含正常吃子）
		>0	升變成特定棋子

*/