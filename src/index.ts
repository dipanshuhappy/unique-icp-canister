import { $query, $update, TimerId, StableBTreeMap, match, Result, ic, Opt } from 'azle';
import { Chess } from 'chess.js';
import { ChessGame } from './types';
import { generateId } from './utils';

// Create an instance of the chess engine
const chess = new Chess();
// Delay in milliseconds for the timer
const DELAY = BigInt(5* 1000000);

// Store the games in a stable B-tree map
let games = new StableBTreeMap<string, ChessGame>(0, 1000, 1_000_000);

// Class representing a game
class Game {
  /**
   * Initialize the Chess Object 
   */
  static init(){
    return {
        id: generateId(),
        board: chess.ascii(),
        fen: chess.fen(),
        history: {
            None: null
        },
        turn:{
            White:null,
            Black:undefined

        },
        is_checkmate:false

    } as ChessGame
  }
  /**
   * Move a white piece in the chess game.
   * @param game The chess game object.
   * @param username The username of the player making the move.
   * @param from The starting position of the piece.
   * @param to The destination position of the piece.
   * @param promotions The optional promotion for the piece (if any).
   * @returns A `Result` object containing either the updated board state or an error message.
   */
  static moveWhite(game: ChessGame, username: string, from: string, to: string, promotions: Opt<string>): Result<string, string> {
    if (game.turn.Black === null) {
      return Result.Err<string, string>("Not your turn");
    }
    chess.load(game.fen);
    const unwrapped_promotion = match(promotions, {
      Some: (promotion) => promotion,
      None: () => undefined
    });
    let move;
    try {
      move = chess.move({ from: from, to: to, promotion: unwrapped_promotion });
    } catch (error) {
      return Result.Err<string, string>(`${error}`);
    }
    if (move) {
      game.board = chess.ascii();
      game.fen = chess.fen();
      game.turn = {
        Black: null,
        White: undefined
      };
      if (game.is_checkmate) {
        return Result.Ok<string, string>(`${game.board} \n Checkmate !`);
      }
      games.insert(username, game);
      return Result.Ok<string, string>(game.board);
    }
    return Result.Err<string, string>("Invalid move");
  }

  /**
   * Move a black piece in the chess game.
   * @param game The chess game object.
   * @param username The username of the player making the move.
   * @param from The starting position of the piece.
   * @param to The destination position of the piece.
   * @param promotions The optional promotion for the piece (if any).
   * @returns A `Result` object containing either the updated board state or an error message.
   */
  static moveBlack(game: ChessGame, username: string, from: string, to: string, promotions: Opt<string>): Result<string, string> {
    if (game.turn.White === null) {
      return Result.Err<string, string>("Not your turn");
    }
    chess.load(game.fen);
    const unwrapped_promotion = match(promotions, {
      Some: (promotion) => promotion,
      None: () => undefined
    });
    let move;
    try {
      move = chess.move({ from: from, to: to, promotion: unwrapped_promotion });
    } catch (error) {
      return Result.Err<string, string>(`${error}`);
    }
    if (!move) {
      return Result.Err<string, string>("Invalid move");
    }
    game.board = chess.ascii();
    game.fen = chess.fen();
    game.turn = {
      White: null,
      Black: undefined
    };
    if (game.is_checkmate) {
      return Result.Ok<string, string>(`${game.board} \n Checkmate !`);
    }
    games.insert(username, game);
    return Result.Ok<string, string>(game.board);
  }
}

/**
 * Create a new chess game.
 * @param username The username of the player creating the game.
 * @returns The newly created chess game object.
 */
$update
export function createGame(username: string): ChessGame {
  if(get_board(username).Ok){
    return ic.trap(`A game with this username already exists`);
  }
  const game = Game.init()
  // Set a timer to check for checkmate
  ic.setTimer(DELAY, () => setCheckMate(username));
  games.insert(username, game);
  return game;
}

/**
 * Check if a player is in checkmate.
 * @param username The username of the player to check.
 */
function setCheckMate(username: string): void {
  let game = match(games.get(username), {
    Some: (game) => game,
    None: () => undefined
  });
  if (!game) {
    return undefined;
  }
  chess.load(game.fen);
  if (chess.isCheckmate()) {
    game.is_checkmate = true;
    games.insert(username, game);
  }
}

/**
 * Get the board state of a chess game.
 * @param username The username of the player.
 * @returns A `Result` object containing either the board state or an error message.
 */
$query
export function get_board(username: string): Result<string, string> {
  return match(games.get(username), {
    Some: (game) => Result.Ok<string, string>(game.board),
    None: () => Result.Err<string, string>("Game not found"),
  });
}

/**
 * Make a white move in the chess game.
 * @param username The username of the player making the move.
 * @param from The starting position of the piece.
 * @param to The destination position of the piece.
 * @param promotions The optional promotion for the piece (if any).
 * @returns A `Result` object containing either the updated board state or an error message.
 */
$update
export function white_move(username: string, from: string, to: string, promotions: Opt<string>): Result<string, string> {
  return match(games.get(username), {
    Some: (game) => Game.moveWhite(game, username, from, to, promotions),
    None: () => Result.Err<string, string>("Game not found"),
  });
}

/**
 * Make a black move in the chess game.
 * @param username The username of the player making the move.
 * @param from The starting position of the piece.
 * @param to The destination position of the piece.
 * @param promotions The optional promotion for the piece (if any).
 * @returns A `Result` object containing either the updated board state or an error message.
 */
$update
export function black_move(username: string, from: string, to: string, promotions: Opt<string>): Result<string, string> {
  return match(games.get(username), {
    Some: (game) => Game.moveBlack(game, username, from, to, promotions),
    None: () => Result.Err<string, string>("Game not found"),
  });
}