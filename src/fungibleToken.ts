/* eslint-disable max-statements */
/* eslint-disable max-lines */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */

import {
  AccountUpdate,
  method,
  PublicKey,
  UInt64,
  Account,
  state,
  State,
  TokenContract,
  AccountUpdateForest,
  DeployArgs,
} from 'o1js';

import errors from './errors';
import {
  type Burnable,
  type Mintable,
} from './interfaces/token/adminable';
import type Viewable from './interfaces/token/viewable';
import type { Transferable } from './interfaces';
import Approvable from './interfaces/token/approvable';

class FungibleToken
  extends TokenContract
  implements
    Approvable,
    Mintable,
    Burnable,
    Viewable,
    Transferable
{
  @state(PublicKey) public adminAccount = State<PublicKey>();
  @state(UInt64) public totalSupply = State<UInt64>();
  @state(UInt64) public circulatingSupply = State<UInt64>();

  public decimals: UInt64 = UInt64.from(9);

  deploy(args: DeployArgs & {
      adminPublicKey: PublicKey,
      totalSupply: UInt64,
      tokenSymbol: string}) {
    super.deploy();
    this.adminAccount.set(args.adminPublicKey);
    this.totalSupply.set(args.totalSupply);
    this.circulatingSupply.set(UInt64.from(0));
    this.account.tokenSymbol.set(args.tokenSymbol);
  }

  requireAdminSignature(): AccountUpdate {
    const adminAccount = this.adminAccount.getAndRequireEquals();
    const adminAccountUpdate = AccountUpdate.createSigned(adminAccount);
    return adminAccountUpdate;
  }

  @method setAdminAccount(adminAccount: PublicKey) {
    this.requireAdminSignature();
    this.adminAccount.set(adminAccount);
  }

  /**
   * Mintable
   */

  @method
  public mint(address: PublicKey, amount: UInt64): AccountUpdate {
    this.requireAdminSignature();

    const totalSupply = this.totalSupply.getAndRequireEquals();
    const circulatingSupply = this.circulatingSupply.getAndRequireEquals();

    const newCirculatingSupply = circulatingSupply.add(amount);
    newCirculatingSupply.assertLessThanOrEqual(
      totalSupply,
      errors.mintAmountExceedsTotalSupply
    );
    this.circulatingSupply.set(newCirculatingSupply);

    return this.internal.mint({ address, amount });
  }

  @method
  public setTotalSupply(amount: UInt64) {
    this.requireAdminSignature();

    this.getCirculatingSupply()
    .assertLessThanOrEqual(amount);

    this.totalSupply.set(amount);
  }

  /**
   * Burnable
   */

  @method
  public burn(from: PublicKey, amount: UInt64): AccountUpdate {
    // If you want to disallow burning without approval from
    // the token admin, you could require a signature here:
    // this.requireAdminSignature();

    this.circulatingSupply.set(
      this.circulatingSupply.getAndRequireEquals()
      .sub(amount));

    return this.internal.burn({ address: from, amount });
  }

  /**
   * Approvable
   */

  @method
  public approveBase(updates: AccountUpdateForest) {
    this.checkZeroBalanceChange(updates);
  }

  /**
   * Viewable
   */

  @method
  public getBalanceOf(address: PublicKey): UInt64 {
    const account = Account(address, this.deriveTokenId());
    const balance = account.balance.get();
    account.balance.requireEquals(balance);

    return balance;
  }

  @method
  public getTotalSupply(): UInt64 {
    return (this.totalSupply.getAndRequireEquals());
  }

  @method
  public getCirculatingSupply(): UInt64 {
    return(this.circulatingSupply.getAndRequireEquals());
  }

  @method
  public getDecimals(): UInt64 {
    return this.decimals;
  }
}

export default FungibleToken;
