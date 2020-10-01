import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Psry from '../lib/psry-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Psry.PsryStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
