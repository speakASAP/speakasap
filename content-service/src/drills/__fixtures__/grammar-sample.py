from marathon.forms import AnswerForm
from speakasap_site.forms import SmartExerciseField


class ComparisonAdjectivesEx1(AnswerForm):
    ex1 = SmartExerciseField(label='Мой лучший друг живёт в этом доме. My [good]{best} friend lives in this house. <span class="mute">(good – хороший)</span>')
    ex2 = SmartExerciseField(label='Кит больше. A whale is [big]{bigger} and [heavy]{heavier}.')
    ex3 = SmartExerciseField(
        label='Ich studier[]{e} nicht. <span class="mute">(studieren – учиться)</span>')


class DemonstrativePronounsEx1(AnswerForm):
    ex1 = SmartExerciseField(label='Is [такой]{zo\'} woordenboek ook duur?')
