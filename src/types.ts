import { Opt, Variant,Record } from "azle";

export type Turn = Variant<{
    White:null,
    Black:null
}>
export type ChessGame = Record<{
    id: string;
    board: string;
    fen:string;
    history: Opt<string>;
    turn: Turn;
    is_checkmate:boolean;
}>