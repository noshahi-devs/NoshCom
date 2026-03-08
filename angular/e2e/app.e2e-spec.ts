import { ElicomTemplatePage } from './app.po';

describe('Elicom App', function () {
    let page: ElicomTemplatePage;

    beforeEach(() => {
        page = new ElicomTemplatePage();
    });

    it('should display message saying app works', () => {
        page.navigateTo();
        expect(page.getParagraphText()).toEqual('app works!');
    });
});
