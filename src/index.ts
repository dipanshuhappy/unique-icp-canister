import { $query, $update, StableBTreeMap, Result, ic, Opt } from 'azle';
import { Chess } from 'chess.js';
import { ChessGame } from './types';
import { generateId } from './utils';

// Create an instance of the chess engine
const chess = new Chess();
// Delay in milliseconds for the timer
const DELAY = BigInt(5);

// Store the games in a stable B-tree map
let games = new StableBTreeMap<string, ChessGame>(0, 1000, 1_000_000);

// Class representing a game
class Game {
  /**
   * Initialize the Chess Object 
   */
  static init(): ChessGame {
    return {
      id: generateId(),
      board: chess.ascii(),
      fen: chess.fen(),
      history: { None: null },
      turn: { White: undefined, Black: null },
      is_checkmate: false
    };
  }

  /**
   * Move a piece in the chess game.
   * @param game The chess game object.
   * @param username The username of the player making the move.
   * @param from The starting position of the piece.
   * @param to The destination position of the piece.
   * @param promotions The optional promotion for the piece (if any).
   * @param isWhiteMove Indicates if it's a white player's move.
   * @returns A `Result` object containing either the updated board state or an error message.
   */
  static movePiece(
    game: ChessGame,
    username: string,
    from: string,
    to: string,
    promotions: Opt<string>,
    isWhiteMove: boolean
  ): Result<string, string> {
    if (isWhiteMove && game.turn.White === null) {
      return Result.Err<string, string>("Not your turn");
    }
    if (!isWhiteMove && game.turn.Black === null) {
      return Result.Err<string, string>("Not your turn");
    }

    chess.load(game.fen);
    const unwrappedPromotion = promotions.Some ? promotions.Some : undefined;
    let move;
    try {
      move = chess.move({ from, to, promotion: unwrappedPromotion });
    } catch (error) {
      return Result.Err<string, string>(`${error}`);
    }

    if (move) {
      game.board = chess.ascii();
      game.fen = chess.fen();
      game.turn.White = isWhiteMove ? undefined : null;
      game.turn.Black = isWhiteMove ? null : undefined;
      if (game.is_checkmate) {
        return Result.Ok<string, string>(`${game.board}\nCheckmate!`);
      }
      games.insert(username, game);
      return Result.Ok<string, string>(game.board);
    }

    return Result.Err<string, string>("Invalid move");
  }
}

/**
 * Create a new chess game.
 * @param username The username of the player creating the game.
 * @returns The newly created chess game object.
 */
$update
export function createGame(username: string): ChessGame {
  if (games.containsKey(username)) {
    throw new Error("Player already has an active game");
  }

  const game = Game.init();

  // Set a timer to check for checkmate
  const timerId = ic.setTimer(DELAY, () => setCheckMate(username));

  games.insert(username, game);
  return game;
}

/**
 * Check if a player is in checkmate.
 * @param username The username of the player to check.
 */
function setCheckMate(username: string): void {
  console.log(`Checking for Check Mate - ${username}`);
  const game = games.get(username);
  if (game.Some) {
    chess.load(game.Some.fen);
    if (chess.isCheckmate()) {
      game.Some.is_checkmate = true;
      games.insert(username, game.Some);
    }
  }
}

/**
 * Get the board state of a chess game.
 * @param username The username of the player.
 * @returns A `Result` object containing either the board state or an error message.
 */
$query
export function getBoard(username: string): Result<string, string> {
  const game = games.get(username);
  if (game.Some) {
    return Result.Ok<string, string>(game.Some.board);
  }
  return Result.Err<string, string>("Game not found");
}

/**
 * Make a move in the chess game.
 * @param username The username of the player making the move.
 * @param from The starting position of the piece.
 * @param to The destination position of the piece.
 * @param promotions The optional promotion for the piece (if any).
 * @param isWhiteMove Indicates if it's a white player's move.
 * @returns A `Result` object containing either the updated board state or an error message.
 */
function makeMove(
  username: string,
  from: string,
  to: string,
  promotions: Opt<string>,
  isWhiteMove: boolean
): Result<string, string> {
  const game = games.get(username);
  if (game.Some) {
    return Game.movePiece(game.Some, username, from, to, promotions, isWhiteMove);
  }
  return Result.Err<string, string>("Game not found");
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
export function whiteMove(username: string, from: string, to: string, promotions: Opt<string>): Result<string, string> {
  return makeMove(username, from, to, promotions, true);
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
export function blackMove(username: string, from: string, to: string, promotions: Opt<string>): Result<string, string> {
  return makeMove(username, from, to, promotions, false);
}
